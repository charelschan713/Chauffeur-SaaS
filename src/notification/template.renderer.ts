export interface TemplateVariables {
  booking_reference?: string;
  customer_first_name?: string;
  customer_last_name?: string;
  pickup_address?: string;
  dropoff_address?: string;
  pickup_time?: string;
  driver_name?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  total_amount?: string;
  currency?: string;
  passenger_name?: string;
  passenger_phone?: string;
}

export function renderTemplate(template: string, vars: TemplateVariables): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const placeholder = `{{${key}}}`;
    while (result.includes(placeholder)) {
      result = result.replace(placeholder, value ?? '');
    }
  }

  // Replace any remaining unknown variables with empty string
  let start = result.indexOf('{{');
  while (start !== -1) {
    const end = result.indexOf('}}', start + 2);
    if (end === -1) break;
    const token = result.slice(start, end + 2);
    result = result.replace(token, '');
    start = result.indexOf('{{');
  }

  return result;
}
