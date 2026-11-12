//! Erros padronizados da API do núcleo. Mensagens em português, pensadas
//! para serem exibidas ao usuário. Nunca incluem senhas ou segredos.

use serde::Serialize;
use std::fmt;

#[derive(Debug, Clone, Serialize)]
pub struct ApiError {
    /// Código estável para tratamento na interface (ex.: "validation", "forbidden").
    pub code: String,
    /// Mensagem legível em português.
    pub message: String,
    /// Campo relacionado ao erro, quando for erro de validação.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub field: Option<String>,
}

pub type ApiResult<T> = Result<T, ApiError>;

impl ApiError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        ApiError { code: code.into(), message: message.into(), field: None }
    }
    pub fn validation(field: &str, message: impl Into<String>) -> Self {
        ApiError { code: "validation".into(), message: message.into(), field: Some(field.into()) }
    }
    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new("forbidden", message)
    }
    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new("not_found", message)
    }
    pub fn unauthenticated() -> Self {
        Self::new("unauthenticated", "Sessão encerrada. Entre novamente no seu perfil.")
    }
    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new("bad_request", message)
    }
    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new("conflict", message)
    }
    pub fn internal(message: impl Into<String>) -> Self {
        Self::new("internal", message)
    }
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for ApiError {}

impl From<rusqlite::Error> for ApiError {
    fn from(e: rusqlite::Error) -> Self {
        crate::logger::error(&format!("sqlite: {e}"));
        match &e {
            rusqlite::Error::QueryReturnedNoRows => ApiError::not_found("Registro não encontrado."),
            rusqlite::Error::SqliteFailure(err, _)
                if err.code == rusqlite::ErrorCode::ConstraintViolation =>
            {
                ApiError::conflict("A operação viola uma regra de integridade dos dados.")
            }
            _ => ApiError::internal("Falha ao acessar o banco de dados local."),
        }
    }
}

impl From<std::io::Error> for ApiError {
    fn from(e: std::io::Error) -> Self {
        crate::logger::error(&format!("io: {e}"));
        ApiError::internal(format!("Falha de arquivo: {e}"))
    }
}

impl From<serde_json::Error> for ApiError {
    fn from(e: serde_json::Error) -> Self {
        ApiError::bad_request(format!("Dados inválidos: {e}"))
    }
}

impl From<zip::result::ZipError> for ApiError {
    fn from(e: zip::result::ZipError) -> Self {
        crate::logger::error(&format!("zip: {e}"));
        ApiError::bad_request(format!("Arquivo de backup inválido ou corrompido: {e}"))
    }
}
