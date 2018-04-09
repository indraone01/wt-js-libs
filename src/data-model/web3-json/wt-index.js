// @flow

import type { WTIndexInterface, HotelInterface, AddHotelResponse, TxReceipt } from '../../interfaces';
import Utils from '../../common-web3/utils';
import Contracts from '../../common-web3/contracts';
import HotelDataProvider from './hotel';

class WTIndexDataProvider implements WTIndexInterface {
  address: string;
  web3Utils: Utils;
  web3Contracts: Contracts;
  deployedIndex: Object; // TODO get rid of Object type

  static async createInstance (indexAddress: string, web3Utils: Utils, web3Contracts: Contracts): Promise<WTIndexDataProvider> {
    return new WTIndexDataProvider(indexAddress, web3Utils, web3Contracts);
  }

  constructor (indexAddress: string, web3Utils: Utils, web3Contracts: Contracts) {
    this.address = indexAddress;
    this.web3Utils = web3Utils;
    this.web3Contracts = web3Contracts;
  }

  async _getDeployedIndex (): Promise<Object> {
    if (!this.deployedIndex) {
      this.deployedIndex = await this.web3Contracts.getIndexInstance(this.address);
    }
    return this.deployedIndex;
  }

  async addHotel (hotelData: HotelInterface): Promise<AddHotelResponse> {
    try {
      const hotel = HotelDataProvider.createInstance(this.web3Utils, this.web3Contracts, await this._getDeployedIndex());
      hotel.setLocalData(hotelData);
      const transactionIds = await hotel.createOnNetwork({
        from: hotelData.manager,
        to: this.address,
      });
      return {
        address: await hotel.address,
        transactionIds: transactionIds,
      };
    } catch (err) {
      // TODO improve error handling
      throw new Error('Cannot add hotel: ' + err.message);
    }
  }

  async updateHotel (hotel: HotelInterface): Promise<Array<string>> {
    try {
      // We need to separate calls to be able to properly catch exceptions
      // TODO make this independent on passed instance type
      const updatedHotel = await hotel.updateOnNetwork({
        from: await hotel.manager,
        to: this.address,
      });
      return updatedHotel;
    } catch (err) {
      // TODO improve error handling
      throw new Error('Cannot update hotel:' + err.message);
    }
  }

  async removeHotel (hotel: HotelInterface): Promise<Array<string>> {
    try {
      // We need to separate calls to be able to properly catch exceptions
      const result = ((hotel: any): HotelDataProvider).removeFromNetwork({ // eslint-disable-line flowtype/no-weak-types
        from: await hotel.manager,
        to: this.address,
      });
      return result;
    } catch (err) {
      // TODO improve error handling
      // invalid opcode -> non-existent hotel
      // invalid opcode -> failed check for manager
      throw new Error('Cannot remove hotel: ' + err.message);
    }
  }

  async getHotel (address: string): Promise<?HotelInterface> {
    const index = await this._getDeployedIndex();
    try {
      // This returns strings
      const hotelIndex = parseInt(await index.methods.hotelsIndex(address).call(), 10);
      // Zeroeth position is preserved during index deployment
      if (!hotelIndex) {
        throw new Error('Not found in hotel list');
      } else {
        return HotelDataProvider.createInstance(this.web3Utils, this.web3Contracts, index, address);
      }
    } catch (err) {
      // TODO better error handling
      throw new Error('Cannot find hotel at ' + address + ': ' + err.message);
    }
  }

  async getAllHotels (): Promise<Array<HotelInterface>> {
    const index = await this._getDeployedIndex();
    const hotelsAddressList = await index.methods.getHotels().call();
    let getHotelDetails = hotelsAddressList
      // Filtering null addresses beforehand improves efficiency
      .filter((addr: string): boolean => !this.web3Utils.isZeroAddress(addr))
      .map((addr: string): Promise<?HotelInterface> => {
        return this.getHotel(addr) // eslint-disable-line promise/no-nesting
          // We don't really care why the hotel is inaccessible
          // and we need to catch exceptions here on each individual hotel
          .catch((err: Error): null => {
            // TODO optional logging
            if (err) {}
            return null;
          });
      });
    const hotelDetails: Array<?HotelInterface> = await (Promise.all(getHotelDetails): any); // eslint-disable-line flowtype/no-weak-types
    const hotelList: Array<HotelInterface> = (hotelDetails.filter((a: ?HotelInterface): boolean => a != null): any); // eslint-disable-line flowtype/no-weak-types
    return hotelList;
  }

  // TODO fix this with web3
  // TODO maybe group multiple transactions together and do some meta over them
  async getTransactionStatus (txHash: string): Promise<TxReceipt> {
    // getTransactionReceipt - reciept not available when tx is pending
    // truffle-contract can throw errors pretty quickly or throws an error when polling for receipt is not successful
    return null;
  }
}

export default WTIndexDataProvider;
