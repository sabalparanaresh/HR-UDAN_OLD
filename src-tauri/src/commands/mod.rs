use tauri::{Command, State, Result};
use crate::services::auth::AuthService;
use crate::services::rbac::resolver::RbacCache;
use crate::services::recovery::RecoveryService;

struct AppState {
    auth_service: AuthService,
    recovery_service: RecoveryService,
}

#[tauri::command]
pub async fn login(
    username: String, 
    password: String, 
    state: State<'_, AppState>
) -> Result<(i64, RbacCache), String> {
    state.auth_service.login(&username, &password).await
}

#[tauri::command]
pub async fn verify_identity(
    mobile: String, 
    birth_date: String, 
    answer_1: String, 
    answer_2: String,
    state: State<'_, AppState>
) -> Result<String, String> {
    state.recovery_service.verify_identity_and_generate_token(&mobile, &birth_date, &answer_1, &answer_2).await
}

#[tauri::command]
pub async fn reset_password(
    token: String, 
    new_password: String, 
    state: State<'_, AppState>
) -> Result<(), String> {
    state.recovery_service.reset_password(&token, &new_password).await
}

pub fn check_permission(
    cache: &RbacCache, 
    permission_string: &str
) -> Result<(), String> {
    if !cache.permissions.contains_key(permission_string) {
        Err(format!("Permission Denied: Missing {}", permission_string))
    } else {
        Ok(())
    }
}
