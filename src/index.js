// @flow

import type { DataModelType, DataModelOptionsType } from './data-model';
import type { WTIndexInterface, AdaptedTxResultsInterface, WalletInterface } from './interfaces';
import DataModel from './data-model';

/**
 * General options for wt-libs-js. Holds all things necessary
 * for successful setup of Winding Tree network.
 *
 * @type WtLibsOptionsType
 */
type WtLibsOptionsType = {
  dataModelType: DataModelType,
  dataModelOptions: DataModelOptionsType
};

/**
 * Main public interface of wt-libs-js.
 */
class WTLibs {
  dataModel: DataModel;
  options: WtLibsOptionsType;

  /**
   * Call this to create wt-libs-js instance. If `dataModelType` is not passed,
   * `web3-swarm` is used as a default. That is subject to change.
   * @param options
   * @return WTLibs
   */
  static createInstance (options: WtLibsOptionsType): WTLibs {
    return new WTLibs(options);
  }

  constructor (options: WtLibsOptionsType) {
    this.options = options || {};
    this.options.dataModelType = this.options.dataModelType || 'web3-swarm';
    this.dataModel = DataModel.createInstance(this.options.dataModelType, this.options.dataModelOptions);
  }

  /**
   * Get an instance of Winding Tree index from the underlying `data-model`.
   *
   * @param address of the Winding Tree index
   * @type Promise<WTIndexInterface>
   */
  async getWTIndex (address: string): Promise<WTIndexInterface> {
    return this.dataModel.getWindingTreeIndex(address);
  }

  /**
   * Get a transactions status from the underlying `data-model`
   */
  async getTransactionsStatus (transactionHashes: Array<string>): Promise<AdaptedTxResultsInterface> {
    return this.dataModel.getTransactionsStatus(transactionHashes);
  }

  async createWallet (jsonWallet: Object): Promise<WalletInterface> {
    return this.dataModel.createWallet(jsonWallet);
  }
}

export default WTLibs;
