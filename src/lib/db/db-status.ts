/** Состояние локальной базы данных */
export type DbStatus = 'not-initialized' | 'ready' | 'error';

let status: DbStatus = 'not-initialized';

export function getDbStatus(): DbStatus {
  return status;
}

export function setDbStatus(next: DbStatus): void {
  status = next;
}
