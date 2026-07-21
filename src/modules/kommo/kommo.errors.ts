export type KommoErrorCode = 'KOMMO_CONFIGURATION_ERROR' | 'KOMMO_UNAUTHORIZED' | 'KOMMO_NOT_FOUND' | 'KOMMO_RATE_LIMITED' | 'KOMMO_TIMEOUT' | 'KOMMO_API_ERROR' | 'KOMMO_INVALID_RESPONSE';
export class KommoError extends Error {
  constructor(readonly code: KommoErrorCode) { super('Nao foi possivel consultar o Kommo.'); this.name = 'KommoError'; }
}
