import { createMockRouteAccessService, createRouteAccessApiClient, type FetchLike, type RouteAccessService } from '../../domain/routeAccess/routeAccess';

export type DriverRuntimeConfig =
  | {
      mode: 'mock';
    }
  | {
      deliveryServerBaseUrl: string;
      mode: 'live';
      thundercrewBaseUrl: string | undefined;
    };

export type DriverRuntimeServices = {
  routeAccessService: RouteAccessService;
};

export function readDriverRuntimeConfig(
  env: Partial<Record<'EXPO_PUBLIC_DELIVERY_SERVER_BASE_URL' | 'EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL', string>>,
): DriverRuntimeConfig {
  const deliveryServerBaseUrl = env.EXPO_PUBLIC_DELIVERY_SERVER_BASE_URL?.trim();
  if (deliveryServerBaseUrl === undefined || deliveryServerBaseUrl === '') {
    return { mode: 'mock' };
  }

  const thundercrewBaseUrl = env.EXPO_PUBLIC_THUNDERCREW_SERVICE_OPS_BASE_URL?.trim() || undefined;

  return {
    deliveryServerBaseUrl,
    mode: 'live',
    thundercrewBaseUrl,
  };
}

export function createDriverRuntimeServices(input: {
  config: DriverRuntimeConfig;
  fetchImpl?: FetchLike;
}): DriverRuntimeServices {
  if (input.config.mode === 'mock') {
    return {
      routeAccessService: createMockRouteAccessService(),
    };
  }

  return {
    routeAccessService: createRouteAccessApiClient({
      baseUrl: input.config.deliveryServerBaseUrl,
      fetchImpl: input.fetchImpl,
    }),
  };
}
