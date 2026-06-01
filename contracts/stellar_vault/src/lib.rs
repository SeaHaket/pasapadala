#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol, log};

// Storage Keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Token,
    ApyBps,              // APY in Basis Points (e.g. 500 = 5.00%)
    LastAccrualLedger,   // Ledger sequence when yield was last compounded
    TotalShares,
    TotalAssets,
    UserShares(Address),
}

const LEDGER_PER_YEAR: u64 = 6_307_200; // ~5 seconds per ledger sequence

#[contract]
pub struct PasaPayYieldVault;

#[contractimpl]
impl PasaPayYieldVault {
    /// Initialize the vault with token address, admin, and APY basis points
    pub fn initialize(env: Env, admin: Address, token: Address, apy_bps: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Vault already initialized");
        }
        
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::ApyBps, &apy_bps);
        env.storage().instance().set(&DataKey::LastAccrualLedger, &env.ledger().sequence());
        env.storage().instance().set(&DataKey::TotalShares, &0i128);
        env.storage().instance().set(&DataKey::TotalAssets, &0i128);
    }

    /// Deposits USDC into the vault in exchange for shares
    pub fn deposit(env: Env, from: Address, amount: i128) -> i128 {
        from.require_auth();
        assert!(amount > 0, "Deposit amount must be positive");

        // 1. Accrue yield up to the current ledger first
        Self::accrue_yield_internal(&env);

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0);

        // 2. Calculate shares to mint (ERC-4626 style)
        let shares = if total_shares == 0 || total_assets == 0 {
            amount
        } else {
            (amount * total_shares) / total_assets
        };

        assert!(shares > 0, "Minted shares must be greater than zero");

        // 3. Perform the token transfer from user to vault
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&from, &env.current_contract_address(), &amount);

        // 4. Update balances and state
        let user_key = DataKey::UserShares(from.clone());
        let current_user_shares: i128 = env.storage().persistent().get(&user_key).unwrap_or(0);
        
        env.storage().persistent().set(&user_key, &(current_user_shares + shares));
        env.storage().instance().set(&DataKey::TotalShares, &(total_shares + shares));
        env.storage().instance().set(&DataKey::TotalAssets, &(total_assets + amount));

        log!(&env, "Deposit successful: user={}, amount={}, shares={}", from, amount, shares);

        shares
    }

    /// Withdraws USDC from the vault by burning shares
    pub fn withdraw(env: Env, to: Address, shares: i128) -> i128 {
        to.require_auth();
        assert!(shares > 0, "Shares to withdraw must be positive");

        // 1. Accrue yield up to current ledger
        Self::accrue_yield_internal(&env);

        let user_key = DataKey::UserShares(to.clone());
        let current_user_shares: i128 = env.storage().persistent().get(&user_key).unwrap_or(0);
        assert!(current_user_shares >= shares, "Insufficient share balance");

        let token_addr: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0);

        // 2. Calculate the corresponding asset amount to payout (ERC-4626 style)
        let amount = (shares * total_assets) / total_shares;
        assert!(amount > 0, "Asset payout must be positive");

        // 3. Update balances and state
        env.storage().persistent().set(&user_key, &(current_user_shares - shares));
        env.storage().instance().set(&DataKey::TotalShares, &(total_shares - shares));
        env.storage().instance().set(&DataKey::TotalAssets, &(total_assets - amount));

        // 4. Perform the token transfer from vault to user
        let token_client = token::Client::new(&env, &token_addr);
        token_client.transfer(&env.current_contract_address(), &to, &amount);

        log!(&env, "Withdrawal successful: user={}, amount={}, shares={}", to, amount, shares);

        amount
    }

    /// Read function: Returns the virtual asset balance of a user (including accrued yield)
    pub fn balance_of(env: Env, user: Address) -> i128 {
        let shares = Self::shares_of(env.clone(), user);
        if shares == 0 {
            return 0;
        }

        // Simulate accrual for read-only accuracy
        let current_ledger = env.ledger().sequence();
        let last_accrual: u32 = env.storage().instance().get(&DataKey::LastAccrualLedger).unwrap_or(0);
        let total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0);
        
        let simulated_assets = if current_ledger > last_accrual && total_assets > 0 {
            let ledgers_elapsed = (current_ledger - last_accrual) as u64;
            let apy_bps: u32 = env.storage().instance().get(&DataKey::ApyBps).unwrap_or(0);
            
            // Compound calculation: assets * (1 + APY * elapsed / total_ledgers)
            let yield_earned = (total_assets * apy_bps as i128 * ledgers_elapsed as i128) / (10000 * LEDGER_PER_YEAR as i128);
            total_assets + yield_earned
        } else {
            total_assets
        };

        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        if total_shares == 0 {
            0
        } else {
            (shares * simulated_assets) / total_shares
        }
    }

    /// Read function: Returns the share balance of a user
    pub fn shares_of(env: Env, user: Address) -> i128 {
        let user_key = DataKey::UserShares(user);
        env.storage().persistent().get(&user_key).unwrap_or(0)
    }

    /// Read function: Returns total assets inside the vault
    pub fn total_assets(env: Env) -> i128 {
        Self::accrue_yield_internal(&env);
        env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0)
    }

    /// Read function: Returns total minted shares
    pub fn total_shares(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0)
    }

    /// Read function: Returns active APY in basis points
    pub fn get_apy(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::ApyBps).unwrap_or(0)
    }

    /// Admin function: Adjust the APY basis points dynamically
    pub fn set_apy(env: Env, apy_bps: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        Self::accrue_yield_internal(&env);
        env.storage().instance().set(&DataKey::ApyBps, &apy_bps);
        
        log!(&env, "APY updated by admin: apy_bps={}", apy_bps);
    }

    /// Trigger manual yield accrual
    pub fn accrue_yield(env: Env) {
        Self::accrue_yield_internal(&env);
    }

    // Helper: Internal yield compounding logic
    fn accrue_yield_internal(env: &Env) {
        let current_ledger = env.ledger().sequence();
        let last_accrual: u32 = env.storage().instance().get(&DataKey::LastAccrualLedger).unwrap_or(0);

        if current_ledger > last_accrual {
            let total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0);
            
            if total_assets > 0 {
                let ledgers_elapsed = (current_ledger - last_accrual) as u64;
                let apy_bps: u32 = env.storage().instance().get(&DataKey::ApyBps).unwrap_or(0);
                
                // Simple interest compounding per elapsed ledger:
                // yield = assets * (apy_bps / 10000) * (elapsed / ledgers_per_year)
                let yield_earned = (total_assets * apy_bps as i128 * ledgers_elapsed as i128) / (10000 * LEDGER_PER_YEAR as i128);
                
                if yield_earned > 0 {
                    env.storage().instance().set(&DataKey::TotalAssets, &(total_assets + yield_earned));
                }
            }
            env.storage().instance().set(&DataKey::LastAccrualLedger, &current_ledger);
        }
    }
}
