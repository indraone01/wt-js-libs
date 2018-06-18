// @flow
import type { OffChainDataAdapterInterface } from './interfaces';

/**
 * OffChainDataClientOptionsType
 */
export type OffChainDataClientOptionsType = {
  adapters: {[schema: string]: {
    options: Object;
    create: (options: Object) => OffChainDataAdapterInterface
  }}
};

let offChainDataOptions: OffChainDataClientOptionsType;

/**
 * OffChainDataClient is a static factory class that is responsible
 * for creating proper instances of OffChainDataAdapterInterface.
 * It is configured during the library initialization.
 *
 * Please bear in mind, that once the adapters are configured, the
 * configuration is shared during the whole runtime.
 */
class OffChainDataClient {
  adapters: Object;

  /**
   * Initializes the map of OffChainDataAdapters.
   *
   * @param  {OffChainDataClientOptionsType}
   */
  static setup (options: OffChainDataClientOptionsType) {
    offChainDataOptions = options || {};
    if (!offChainDataOptions.adapters) {
      offChainDataOptions.adapters = {};
    }
  }

  /**
   * Drops all pre-configured OffChainDataAdapters. Useful for testing.
   */
  static __reset () {
    offChainDataOptions.adapters = {};
  }

  /**
   * Returns a fresh instance of an appropriate OffChainDataAdapter by
   * calling the `create` function from the adapter's configuration.
   *
   * @throws {Error} when schema is not defined or adapter for this schema does not exist
   */
  static async getAdapter (schema: ?string): Promise<OffChainDataAdapterInterface> {
    if (!schema || !offChainDataOptions.adapters[schema]) {
      throw new Error(`Unsupported data storage type: ${schema || 'null'}`);
    }
    const adapter = offChainDataOptions.adapters[schema];
    return adapter.create(adapter.options);
  }
}

export default OffChainDataClient;