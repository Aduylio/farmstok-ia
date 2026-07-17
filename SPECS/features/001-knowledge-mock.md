# Feature 001 — Módulo de conhecimento simulado

## Objetivo

Criar um endpoint que receba uma pergunta e devolva uma resposta estruturada, ainda sem banco de dados e sem inteligência artificial.

## Endpoint

POST /api/knowledge/ask

## Entrada

```json
{
  "question": "Onde encontro a aula sobre Curva ABC?"
}