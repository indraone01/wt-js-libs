import { assert } from 'chai';
import sinon from 'sinon';
import StoragePointer from '../../src/storage-pointer';
import OffChainDataClient from '../../src/off-chain-data-client';
import InMemoryAdapter from '@windingtree/off-chain-adapter-in-memory';
import { StoragePointerError, OffChainDataRuntimeError } from '../../src/errors';

describe('WTLibs.StoragePointer', () => {
  beforeEach(() => {
    OffChainDataClient.setup({
      adapters: {
        'in-memory': {
          create: () => {
            return new InMemoryAdapter();
          },
        },
        'bzz-raw': {
          create: () => {
            return new InMemoryAdapter();
          },
        },
      },
    });
  });

  afterEach(() => {
    OffChainDataClient._reset();
  });

  describe('initialization', () => {
    it('should normalize fields option', () => {
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields', { name: 'field' }]);
      assert.equal(pointer._fields.length, 3);
      assert.isDefined(pointer._fields[0].name);
      assert.isDefined(pointer._fields[1].name);
      assert.isDefined(pointer._fields[2].name);
      assert.equal(pointer._fields[0].name, 'some');
      assert.equal(pointer._fields[1].name, 'fields');
      assert.equal(pointer._fields[2].name, 'field');
    });

    it('should throw on name conflicts', () => {
      assert.throws(() => {
        StoragePointer.createInstance('in-memory://url', ['FiElds', 'fields', { name: 'some' }]);
      }, StoragePointerError, /conflict in field names/i);
      
      assert.throws(() => {
        StoragePointer.createInstance('in-memory://url', ['FiElds', { name: 'fields' }]);
      }, StoragePointerError, /conflict in field names/i);
    });

    it('should not panic on empty fields list', () => {
      assert.doesNotThrow(() => {
        StoragePointer.createInstance('in-memory://url');
      });
    });

    it('should throw on an empty uri', () => {
      assert.throws(() => {
        StoragePointer.createInstance('');
      }, StoragePointerError, /without uri/i);

      assert.throws(() => {
        StoragePointer.createInstance();
      }, StoragePointerError, /without uri/i);
    });

    it('should properly set ref and contents', () => {
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields']);
      assert.equal(pointer.ref, 'in-memory://url');
      assert.isDefined(pointer.contents);
    });

    it('should initialize data getters', () => {
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields']);
      assert.equal(pointer.ref, 'in-memory://url');
      assert.isDefined(pointer.contents.some);
      assert.isDefined(pointer.contents.fields);
    });

    it('should throw if StoragePointer cannot be set up due to bad uri format', async () => {
      try {
        const pointer = StoragePointer.createInstance('jsonxxurl', [{
          name: 'sp',
          isStoragePointer: true,
          fields: ['some', 'fields'],
        }]);
        await pointer.contents.sp;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /unsupported data storage type/i);
      }
    });
  });

  describe('data downloading', () => {
    it('should not download the data immediately', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields']);
      const dldSpy = sinon.spy(pointer, '_downloadFromStorage');
      assert.equal(dldSpy.callCount, 0);
      await pointer.contents.some;
      assert.equal(dldSpy.callCount, 1);
      await pointer.contents.fields;
      assert.equal(dldSpy.callCount, 1);
    });

    it('should properly instantiate OffChainDataAdapter', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields']);
      assert.isUndefined(pointer._adapter);
      await pointer.contents.some;
      assert.isDefined(pointer._adapter);
    });

    it('should reuse OffChainDataAdapter instance', async () => {
      const getAdapterSpy = sinon.spy(OffChainDataClient, 'getAdapter');
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields']);
      assert.equal(getAdapterSpy.callCount, 0);
      await pointer.contents.some;
      assert.equal(getAdapterSpy.callCount, 1);
      await pointer._getOffChainDataClient();
      assert.equal(getAdapterSpy.callCount, 1);
      getAdapterSpy.restore();
    });

    it('should throw when an unsupported schema is encountered', async () => {
      try {
        const pointer = StoragePointer.createInstance('random://url', ['some', 'fields']);
        await pointer.contents.some;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /unsupported data storage type/i);
        assert.instanceOf(e, OffChainDataRuntimeError);
      }
    });

    it('should throw when the adapter throws on download', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url-1234', ['some', 'fields']);
      sinon.stub(OffChainDataClient, 'getAdapter').returns({
        download: sinon.stub().rejects(),
      });
      try {
        await pointer.contents.some;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /cannot download data/i);
        assert.instanceOf(e, StoragePointerError);
      } finally {
        OffChainDataClient.getAdapter.restore();
      }
    });

    it('should not panic on schema with a dash in it', async () => {
      const pointer = StoragePointer.createInstance('bzz-raw://url', ['some', 'fields']);
      assert.isUndefined(pointer._adapter);
      await pointer.contents.some;
      assert.isDefined(pointer._adapter);
    });
  });

  describe('recursion', () => {
    it('should recursively instantiate another StoragePointer', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', [{
        name: 'sp',
        isStoragePointer: true,
        fields: ['some', 'fields'],
      }]);
      sinon.stub(pointer, '_getOffChainDataClient').returns({
        download: sinon.stub().returns({
          'sp': 'in-memory://point',
        }),
      });
      assert.equal(pointer.ref, 'in-memory://url');
      const recursivePointer = await pointer.contents.sp;
      assert.equal(recursivePointer.constructor.name, 'StoragePointer');
      assert.equal(recursivePointer.ref, 'in-memory://point');
      assert.isDefined(recursivePointer.contents.some);
      assert.isDefined(recursivePointer.contents.fields);
    });

    it('should not panic if recursive StoragePointer does not have fields defined', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', [{
        name: 'sp',
        isStoragePointer: true,
      }]);
      sinon.stub(pointer, '_getOffChainDataClient').returns({
        download: sinon.stub().returns({
          'sp': 'in-memory://point',
        }),
      });
      assert.equal(pointer.ref, 'in-memory://url');
      await pointer.contents.sp;
    });

    it('should throw if recursive StoragePointer cannot be set up due to null pointer value', async () => {
      try {
        const pointer = StoragePointer.createInstance('in-memory://url', [{
          name: 'sp',
          isStoragePointer: true,
          fields: ['some', 'fields'],
        }]);
        await pointer.contents.sp;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /which does not appear to be a valid reference/i);
      }
    });

    it('should throw if recursive StoragePointer cannot be set up due to a malformed pointer value', async () => {
      try {
        const pointer = StoragePointer.createInstance('in-memory://url', [{
          name: 'sp',
          isStoragePointer: true,
          fields: ['some', 'fields'],
        }]);
        sinon.stub(pointer, '_getOffChainDataClient').returns({
          download: sinon.stub().returns({
            'sp': { some: 'field' },
          }),
        });
        await pointer.contents.sp;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /which does not appear to be a valid reference/i);
      }
    });

    it('should throw if recursive StoragePointer cannot be set up due to bad schema', async () => {
      try {
        const pointer = StoragePointer.createInstance('in-memory://url', [{
          name: 'sp',
          isStoragePointer: true,
          fields: ['some', 'fields'],
        }]);
        sinon.stub(pointer, '_getOffChainDataClient').returns({
          download: sinon.stub().returns({
            'sp': 'random://point',
          }),
        });
        assert.equal(pointer.ref, 'in-memory://url');
        const childPointer = await pointer.contents.sp;
        await childPointer.contents.some;
        throw new Error('should have never been called');
      } catch (e) {
        assert.match(e.message, /unsupported data storage type/i);
      }
    });
  });

  describe('reset()', () => {
    it('should force repeated download', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields']);
      const adapter = await pointer._getOffChainDataClient();
      const dldSpy = sinon.spy(adapter, 'download');
      assert.equal(dldSpy.callCount, 0);
      await pointer.contents.some;
      assert.equal(dldSpy.callCount, 1);
      await pointer.contents.fields;
      assert.equal(dldSpy.callCount, 1);
      await pointer.reset();
      assert.equal(dldSpy.callCount, 1);
      await pointer.contents.some;
      assert.equal(dldSpy.callCount, 2);
    });

    it('should allow repeated reset', async () => {
      const pointer = StoragePointer.createInstance('in-memory://url', ['some', 'fields']);
      const adapter = await pointer._getOffChainDataClient();
      const dldSpy = sinon.spy(adapter, 'download');
      await pointer.contents.some;
      assert.equal(dldSpy.callCount, 1);
      await pointer.reset();
      await pointer.reset();
      await pointer.reset();
      await pointer.contents.some;
      assert.equal(dldSpy.callCount, 2);
    });
  });

  describe('toPlainObject', () => {
    let pointer, hashLevelZero, hashLevelOne, hashLevelTwo, hashLevelThree;
    before(() => {
      hashLevelThree = InMemoryAdapter.storageInstance.create({ below: 'cows', above: 'sheep' });
      hashLevelTwo = InMemoryAdapter.storageInstance.create({ one: 'bunny', two: 'frogs', below: `in-memory://${hashLevelThree}` });
      hashLevelOne = InMemoryAdapter.storageInstance.create({ three: 'dogs', four: 'donkeys', five: `in-memory://${hashLevelTwo}` });
      hashLevelZero = InMemoryAdapter.storageInstance.create({ six: 'horses', seven: 'cats', eight: `in-memory://${hashLevelOne}`, nine: `in-memory://${hashLevelTwo}` });
      pointer = StoragePointer.createInstance(`in-memory://${hashLevelZero}`, [
        'six', 'seven', {
          name: 'eight',
          isStoragePointer: true,
          fields: [
            'three', 'four',
            {
              name: 'five',
              isStoragePointer: true,
              fields: ['one', 'two', {
                name: 'below',
                isStoragePointer: true,
                fields: ['below', 'above'],
              }],
            },
          ],
        }, {
          name: 'nine',
          isStoragePointer: true,
          fields: ['one', 'two', {
            name: 'below',
            isStoragePointer: true,
            fields: ['below', 'above'],
          }],
        },
      ]);
    });

    it('should return a complete data tree without arguments', async () => {
      const pojo = await pointer.toPlainObject();
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');
      assert.equal(pojo.contents.nine.contents.one, 'bunny');
      assert.equal(pojo.contents.nine.contents.two, 'frogs');
      assert.equal(pojo.contents.nine.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.nine.contents.below.contents.above, 'sheep');
    });

    it('should limit resolved fields', async () => {
      const pojo = await pointer.toPlainObject(['eight']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');
      assert.equal(pojo.contents.nine, `in-memory://${hashLevelTwo}`);
    });

    it('should resolve multiple recursive fields', async () => {
      const pojo = await pointer.toPlainObject(['eight.five.two', 'nine.below.above']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.nine.contents.one, 'bunny');
      assert.equal(pojo.contents.nine.contents.below.contents.above, 'sheep');
    });

    it('should resolve field on a second level', async () => {
      const pojo = await pointer.toPlainObject(['eight.four', 'eight.three']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.equal(pojo.contents.eight.contents.five, `in-memory://${hashLevelTwo}`);
    });

    it('should resolve field on a second level when asked for multiple times', async () => {
      const pojo = await pointer.toPlainObject(['eight.five']);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.isDefined(pojo.contents.eight);
      assert.equal(pojo.contents.eight.contents.three, 'dogs');
      assert.equal(pojo.contents.eight.contents.four, 'donkeys');
      assert.isDefined(pojo.contents.eight.contents.five);
      assert.equal(pojo.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');

      const pojo2 = await pointer.toPlainObject(['eight.five.one']);
      assert.equal(pojo2.contents.six, 'horses');
      assert.equal(pojo2.contents.seven, 'cats');
      assert.isDefined(pojo2.contents.eight);
      assert.equal(pojo2.contents.eight.contents.three, 'dogs');
      assert.equal(pojo2.contents.eight.contents.four, 'donkeys');
      assert.isDefined(pojo2.contents.eight.contents.five);
      assert.equal(pojo2.contents.eight.contents.five.contents.one, 'bunny');
      assert.equal(pojo2.contents.eight.contents.five.contents.two, 'frogs');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.below, 'cows');
      assert.equal(pojo.contents.eight.contents.five.contents.below.contents.above, 'sheep');
    });

    it('should allow the user to not resolve any field', async () => {
      const pojo = await pointer.toPlainObject([]);
      assert.equal(pojo.contents.six, 'horses');
      assert.equal(pojo.contents.seven, 'cats');
      assert.equal(pojo.contents.eight, `in-memory://${hashLevelOne}`);
      assert.equal(pojo.contents.nine, `in-memory://${hashLevelTwo}`);
    });

    it('should not report undefined for missing fields', async () => {
      const hash = InMemoryAdapter.storageInstance.create({ six: 'horses', seven: 'cats', nine: undefined });
      const pointer = StoragePointer.createInstance(`in-memory://${hash}`, [
        'six', 'seven', 'eight', 'nine',
      ]);
      const pojo = await pointer.toPlainObject();
      assert.property(pojo.contents, 'six');
      assert.property(pojo.contents, 'seven');
      assert.notProperty(pojo.contents, 'eight');
      assert.property(pojo.contents, 'nine');
      assert.isUndefined(pojo.contents.nine);
    });
  });
});
