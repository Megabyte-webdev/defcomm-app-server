# Tauri Update Server

A lightweight update server for Tauri desktop applications that securely fetches releases from private GitHub repositories.

## What It Does

- **Securely proxies GitHub releases** – Keeps your GitHub token private
- **Handles multiple Tauri apps** – One server for all your applications
- **Auto-detects platforms** – Windows, macOS, and Linux support
- **Validates update signatures** – Ensures binary integrity
- **Caches responses** – Fast checks with Redis or in-memory cache
- **Rate limiting & API key auth** – Protects your endpoints

## How It Works
