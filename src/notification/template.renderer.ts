import { TemplateVariables } from './notification.types';

export { TemplateVariables };

export function renderTemplate(template: string, vars: TemplateVariables): string {
  let result = template;

  // Handle {{#if <var>}}...{{/if}} blocks (truthy = non-empty string or number > 0)
  result = result.replace(/\{\{#if (\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, key, inner) => {
    const val = (vars as Record<string, unknown>)[key];
    const truthy = val !== undefined && val !== null && val !== '' && val !== 0 && val !== '0';
    return truthy ? inner : '';
  });

  // Replace all {{variable}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const val = (vars as Record<string, unknown>)[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });

  return result;
}
