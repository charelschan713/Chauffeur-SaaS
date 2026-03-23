export type WidgetSettings = {
  returnTrip?: boolean;
  flightNumber?: boolean;
  waypoints?: boolean;
  passengers?: boolean;
  luggage?: boolean;
  babySeats?: boolean;
  promoCode?: boolean;
  customCss?: string;
  customCssUrl?: string;
};

export const DEFAULT_WIDGET_SETTINGS: Required<WidgetSettings> = {
  returnTrip: false,
  flightNumber: false,
  waypoints: false,
  passengers: false,
  luggage: false,
  babySeats: false,
  promoCode: false,
};

export function withDefaults(ws?: WidgetSettings | null): Required<WidgetSettings> {
  return {
    returnTrip: ws?.returnTrip ?? DEFAULT_WIDGET_SETTINGS.returnTrip,
    flightNumber: ws?.flightNumber ?? DEFAULT_WIDGET_SETTINGS.flightNumber,
    waypoints: ws?.waypoints ?? DEFAULT_WIDGET_SETTINGS.waypoints,
    passengers: ws?.passengers ?? DEFAULT_WIDGET_SETTINGS.passengers,
    luggage: ws?.luggage ?? DEFAULT_WIDGET_SETTINGS.luggage,
    babySeats: ws?.babySeats ?? DEFAULT_WIDGET_SETTINGS.babySeats,
    promoCode: ws?.promoCode ?? DEFAULT_WIDGET_SETTINGS.promoCode,
  };
}
