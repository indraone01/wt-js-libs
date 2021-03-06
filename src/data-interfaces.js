// @flow

export interface PlainHotelInterface {
  address: Promise<?string> | ?string,
  manager: Promise<?string> | ?string,
  dataUri: Promise<{ref: string, contents: Object}> | {ref: string, contents: Object}
}

/**
 * Index file for more data URIs. This is the
 * initial document that blockchain is pointing to.
 */
export interface HotelDataIndex {
  descriptionUri: string
}

/**
 * Description of additional descriptive hotel data.
 * @see https://github.com/windingtree/wt-js-libs/issues/125
 */
export interface HotelDescriptionInterface {
  location?: Promise<?LocationInterface> | ?LocationInterface,
  name: Promise<string> | string,
  description: Promise<string> | string,
  roomTypes?: Promise<?{ [id: string]: RoomTypeInterface }> | ?{ [id: string]: RoomTypeInterface },
  contacts: Promise<ContactsInterface> | ContactsInterface,
  address: Promise<AddressInterface> | AddressInterface,
  timezone: Promise<string> | string,
  currency: Promise<string> | string,
  images?: Promise<?Array<string>> | ?Array<string>,
  amenities?: Promise<?Array<string>> | ?Array<string>,
  updatedAt: Promise<string> | string
}

export interface RoomTypeInterface {
  name: Promise<string> | string,
  description: Promise<string> | string,
  totalQuantity: Promise<number> | number,
  occupancy: Promise<OccupancyInterface> | OccupancyInterface,
  amenities?: Promise<?Array<string>> | ?Array<string>,
  images?: Promise<?Array<string>> | ?Array<string>,
  updatedAt: Promise<?Date> | ?Date,
  properties?: Promise<?Object> | ?Object
}

export interface OccupancyInterface {
  min?: ?number,
  max: number
}

/**
 * Generic GPS location.
 */
export interface LocationInterface {
  latitude?: ?number,
  longitude?: ?number
}

/**
 * Generic additional contact.
 */
export interface AdditionalContact {
  title: string,
  value: string
}

/**
 * Generic contact.
 */
export interface ContactInterface {
  email?: Promise<?string> | ?string,
  phone?: Promise<?string> | ?string,
  url?: Promise<?string> | ?string,
  ethereum?: Promise<?string> | ?string,
  additionalContacts?: Promise<?Array<AdditionalContact>> | ?Array<AdditionalContact>
}

/**
 * A map of hotel contacts.
 */
export interface ContactsInterface {
  general: ContactInterface
}

/**
 * Generic address interface.
 */
export interface AddressInterface {
  line1?: Promise<string> | string,
  line2?: Promise<?string> | ?string,
  postalCode?: Promise<?string> | ?string,
  city?: Promise<string> | string,
  state?: Promise<?string> | ?string,
  country?: Promise<string> | string
}
