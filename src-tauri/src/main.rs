// =====================================================================
//  INVASÃO.EXE — app de desktop (Tauri) para o dia do evento.
//  Abre o jogo em tela cheia (sair: Alt + F4), sem depender do navegador
//  instalado, e guarda uma cópia do ranking em arquivo.
// =====================================================================

// Sem janela de console extra no Windows (build de release)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::io::ErrorKind;
use std::path::PathBuf;
use tauri::Manager;

// Só estes dados podem ser salvos/lidos como backup (as chaves do localStorage do jogo)
const BACKUPS_PERMITIDOS: [&str; 2] = ["invasao_exe_ranking_v1", "invasao_exe_ajustes_v1"];

fn pasta_backups(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("backups");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

fn validar_backup(nome: &str) -> Result<(), String> {
    if BACKUPS_PERMITIDOS.contains(&nome) {
        Ok(())
    } else {
        Err(format!("backup não permitido: {nome}"))
    }
}

/// Grava o backup de forma atômica (arquivo temporário + renomear):
/// se o PC desligar no meio, o backup anterior continua inteiro.
#[tauri::command]
fn salvar_backup(app: tauri::AppHandle, nome: String, conteudo: String) -> Result<(), String> {
    validar_backup(&nome)?;
    let dir = pasta_backups(&app)?;
    let temporario = dir.join(format!("{nome}.json.tmp"));
    fs::write(&temporario, conteudo).map_err(|e| e.to_string())?;
    fs::rename(&temporario, dir.join(format!("{nome}.json"))).map_err(|e| e.to_string())
}

#[tauri::command]
fn ler_backup(app: tauri::AppHandle, nome: String) -> Result<Option<String>, String> {
    validar_backup(&nome)?;
    match fs::read_to_string(pasta_backups(&app)?.join(format!("{nome}.json"))) {
        Ok(conteudo) => Ok(Some(conteudo)),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

/// Salva o CSV do ranking na pasta Downloads e devolve o caminho completo.
#[tauri::command]
fn exportar_csv(app: tauri::AppHandle, nome: String, conteudo: String) -> Result<String, String> {
    let nome_seguro = nome.ends_with(".csv")
        && !nome.contains("..")
        && nome
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '_' | '.'));
    if !nome_seguro {
        return Err("nome de arquivo inválido".into());
    }
    let pasta = app
        .path()
        .download_dir()
        .or_else(|_| app.path().document_dir())
        .map_err(|e| e.to_string())?;
    let destino = pasta.join(&nome);
    fs::write(&destino, conteudo).map_err(|e| e.to_string())?;
    Ok(destino.display().to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![salvar_backup, ler_backup, exportar_csv])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o INVASÃO.EXE");
}
