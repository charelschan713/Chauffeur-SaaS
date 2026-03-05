import { TemplateVariables } from './notification.types';

export { TemplateVariables };

export function renderTemplate(template: string, vars: TemplateVariables): string {
  let result = template;

  // Handle {{#if waypoint_count}}...{{/if}} blocks
  result = result.replace(/\{\{#if waypoint_count\}\}([\s\S]*?)\{\{\/if\}\}/g, (_match, inner) => {
    const count = (vars.waypoint_count as number | undefined) ?? 0;
    return count > 0 ? inner : '';
  });

  // Replace all {{variable}} placeholders
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    const val = (vars as Record<string, unknown>)[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });

  return result;
}
