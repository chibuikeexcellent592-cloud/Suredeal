import type { AdminPhoneAlertDispatch } from '../src/types.ts';

export async function dispatchAdminPhoneAlert(_params: {
  eventType: AdminPhoneAlertDispatch['eventType'];
  message: string;
}): Promise<void> {
  // Phone Alert Dispatches retired per storefront preferences.
}
