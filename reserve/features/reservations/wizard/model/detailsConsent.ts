import type { DetailsFormInputValues, DetailsFormValues } from './schemas';

export function buildAcceptedDetailsValues(
  values: DetailsFormInputValues,
  whatsappOptIn: boolean,
): DetailsFormValues {
  return {
    ...values,
    agree: true,
    rememberDetails: true,
    marketingOptIn: true,
    whatsappOptIn,
  };
}
