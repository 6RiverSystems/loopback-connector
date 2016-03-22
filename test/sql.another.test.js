var expect = require('chai').expect;
var SQLConnector = require('../lib/sql');
var ParameterizedSQL = SQLConnector.ParameterizedSQL;
var testConnector = require('./connectors/test-sql-connector');

var juggler = require('loopback-datasource-juggler');
var ds = new juggler.DataSource({
  connector: testConnector,
  debug: true
});
var connector;
var Customer;
var Order;
var Store;

describe('sql connector', function() {
  before(function() {
    connector = ds.connector;
    connector._tables = {};
    connector._models = {};
    Customer = ds.createModel('customer',
      {
        name: {
          id: true,
          type: String,
          testdb: {
            column: 'NAME',
            dataType: 'VARCHAR',
            dataLength: 32
          }
        },
        vip: {
          type: Boolean,
          testdb: {
            column: 'VIP'
          }
        },
        address: String
      },
      {testdb: {table: 'CUSTOMER'}}
    );

    Order = ds.createModel('order',
      {
        id: {
          id: true
        },
        date: Date
      }
    );

    Store = ds.createModel('store',
      {
        id: {
          id: true,
          type: String
        },
        state: String
      }
    );

    // Relations
    Customer.hasMany(Order, {as: 'orders', foreignKey: 'customer_id'});
    Order.belongsTo(Customer, {as: 'customer', foreignKey: 'customer_id'});
    Order.belongsTo(Store, {as: 'store', foreignKey: 'store_id'});
    Store.hasMany(Order, {as: 'orders', foreignKey: 'store_id'});
    Store.hasMany(Customer, {
      as: 'customers',
      through: Order,
      foreignKey: 'storeId',
      keyThrough: 'customerId'
    });
    Customer.belongsTo(Store, {as: 'store', foreignKey: 'store_id'});
    Store.hasMany(Customer, {as: 'customers', foreignKey: 'store_id'});
  });

  it('should map table name', function() {
    var table = connector.table('customer');
    expect(table).to.eql('CUSTOMER');
  });

  it('should map column name', function() {
    var column = connector.column('customer', 'name');
    expect(column).to.eql('NAME');
  });

  it('should find column metadata', function() {
    var column = connector.columnMetadata('customer', 'name');
    expect(column).to.eql({
      column: 'NAME',
      dataType: 'VARCHAR',
      dataLength: 32
    });
  });

  it('should map property name', function() {
    var prop = connector.propertyName('customer', 'NAME');
    expect(prop).to.eql('name');
  });

  it('should map id column name', function() {
    var idCol = connector.idColumn('customer');
    expect(idCol).to.eql('NAME');
  });

  it('should find escaped id column name', function() {
    var idCol = connector.idColumnEscaped('customer');
    expect(idCol).to.eql('`NAME`');
  });

  it('should find escaped table name', function() {
    var table = connector.tableEscaped('customer');
    expect(table).to.eql('`CUSTOMER`');
  });

  it('should find escaped column name', function() {
    var column = connector.columnEscaped('customer', 'vip');
    expect(column).to.eql('`VIP`');
  });

  it('should find qualified column name', function() {
    var column = connector.columnEscaped('customer', 'vip', true);
    expect(column).to.eql('`CUSTOMER`.`VIP`');
  });

  it('should convert to escaped id column value', function() {
    var column = connector.idColumnValue('customer', 'John');
    expect(column).to.eql('John');
  });

  it('builds where', function() {
    var where = connector.buildWhere('customer', {name: 'John'});
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `NAME`=?',
      params: ['John']
    });
  });

  it('builds where', function() {
    var where = connector.buildWhere('order', {customer: {name: 'John'}}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME`=?',
      params: ['John']
    });
  });

  it('builds qualified where', function() {
    var where = connector.buildWhere('customer', {name: 'John'}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME`=?',
      params: ['John']
    });
  });

  it('builds where with null', function() {
    var where = connector.buildWhere('customer', {name: null}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` IS NULL',
      params: []
    });
  });

  it('builds where with inq', function() {
    var where = connector.buildWhere('customer', {name: {inq: ['John', 'Mary']}}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` IN (?,?)',
      params: ['John', 'Mary']
    });
  });

  it('builds where with or', function() {
    var where = connector.buildWhere('customer',
      {or: [{name: 'John'}, {name: 'Mary'}]}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE (`CUSTOMER`.`NAME`=?) OR (`CUSTOMER`.`NAME`=?)',
      params: ['John', 'Mary']
    });
  });

  it('builds where with or and relation', function() {
    var where = connector.buildWhere('customer',
      {or: [{name: 'John'}, {store: {state: 'NY'}}]}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE (`CUSTOMER`.`NAME`=?) OR (`STORE`.`STATE`=?)',
      params: ['John', 'NY']
    });
  });

  it('builds where with and', function() {
    var where = connector.buildWhere('customer',
      {and: [{name: 'John'}, {vip: true}]}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE (`CUSTOMER`.`NAME`=?) AND (`CUSTOMER`.`VIP`=?)',
      params: ['John', true]
    });
  });

  it('builds where with and + relation', function() {
    var where = connector.buildWhere('customer',
      {and: [{name: 'John'}, {store: {state: 'NY'}}]}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE (`CUSTOMER`.`NAME`=?) AND (`STORE`.`STATE`=?)',
      params: ['John', 'NY']
    });
  });

  it('builds where with a regexp string that does not have flags', function() {
    var where = connector.buildWhere('customer', {
      name: {
        regexp: '^J'
      }
    }, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` REGEXP ?',
      params: ['^J']
    });
  });

  it('builds where with a regexp string that has flags', function() {
    var where = connector.buildWhere('customer', {
      name: {
        regexp: '^J/i'
      }
    }, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` REGEXP ?',
      params: ['^J/i']
    });
  });

  it('builds where with a regexp literal that does not have flags', function() {
    var where = connector.buildWhere('customer', {
      name: {
        regexp: /^J/
      }
    }, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` REGEXP ?',
      params: [/^J/]
    });
  });

  it('builds where with a regexp literal that has flags', function() {
    var where = connector.buildWhere('customer', {
      name: {
        regexp: /^J/i
      }
    }, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` REGEXP ?',
      params: [/^J/i]
    });
  });

  it('builds where with a regexp object that does not have flags', function() {
    var where = connector.buildWhere('customer', {
      name: {
        regexp: new RegExp(/^J/)
      }
    }, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` REGEXP ?',
      params: [/^J/]
    });
  });

  it('builds where with a regexp object that has flags', function() {
    var where = connector.buildWhere('customer', {
      name: {
        regexp: new RegExp(/^J/i)
      }
    }, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE `CUSTOMER`.`NAME` REGEXP ?',
      params: [new RegExp(/^J/i)]
    });
  });

  it('builds where with nesting and/or', function() {
    var where = connector.buildWhere('customer',
      {and: [{name: 'John'}, {or: [{vip: true}, {address: null}]}]}, true);
    expect(where.toJSON()).to.eql({
      sql: 'WHERE (`CUSTOMER`.`NAME`=?) AND ((`CUSTOMER`.`VIP`=?) OR (`CUSTOMER`.`ADDRESS` IS NULL))',
      params: ['John', true]
    });
  });

  it('builds order by with one field', function() {
    var orderBy = connector.buildOrderBy('customer', 'name');
    expect(orderBy).to.eql('ORDER BY `CUSTOMER`.`NAME`');
  });

  it('builds order by with two fields', function() {
    var orderBy = connector.buildOrderBy('customer', ['name', 'vip']);
    expect(orderBy).to.eql('ORDER BY `CUSTOMER`.`NAME`,`CUSTOMER`.`VIP`');
  });

  it('builds order by with two fields and dirs', function() {
    var orderBy = connector.buildOrderBy('customer', ['name ASC', 'vip DESC']);
    expect(orderBy).to.eql('ORDER BY `CUSTOMER`.`NAME` ASC,`CUSTOMER`.`VIP` DESC');
  });

  it('builds fields for columns', function() {
    var fields = connector.buildFields('customer',
      {name: 'John', vip: true, unknown: 'Random'}, false, true);
    expect(fields.names).to.eql(['`CUSTOMER`.`NAME`', '`CUSTOMER`.`VIP`']);
    expect(fields.columnValues[0].toJSON()).to.eql(
      {sql: '?', params: ['John']});
    expect(fields.columnValues[1].toJSON()).to.eql(
      {sql: '?', params: [true]});
  });

  it('builds fields for UPDATE without ids', function() {
    var fields = connector.buildFieldsForUpdate('customer',
      {name: 'John', vip: true});
    expect(fields.toJSON()).to.eql({
      sql: 'SET `CUSTOMER`.`VIP`=?',
      params: [true]
    });
  });

  it('builds fields for UPDATE with ids', function() {
    var fields = connector.buildFieldsForUpdate('customer',
      {name: 'John', vip: true}, false);
    expect(fields.toJSON()).to.eql({
      sql: 'SET `CUSTOMER`.`NAME`=?,`CUSTOMER`.`VIP`=?',
      params: ['John', true]
    });
  });

  it('builds column names for SELECT', function() {
    var cols = connector.buildColumnNames('customer', {}, true);
    expect(cols).to
      .eql('`CUSTOMER`.`NAME`,`CUSTOMER`.`VIP`,`CUSTOMER`.`ADDRESS`,`CUSTOMER`.`STORE_ID`');
  });

  it('builds column names with true fields filter for SELECT', function() {
    var cols = connector.buildColumnNames('customer', {fields: {name: true}}, true);
    expect(cols).to.eql('`CUSTOMER`.`NAME`');
  });

  it('builds column names with false fields filter for SELECT', function() {
    var cols = connector.buildColumnNames('customer', {fields: {name: false}}, true);
    expect(cols).to.eql('`CUSTOMER`.`VIP`,`CUSTOMER`.`ADDRESS`,`CUSTOMER`.`STORE_ID`');
  });

  it('builds column names with array fields filter for SELECT', function() {
    var cols = connector.buildColumnNames('customer', {fields: ['name']}, true);
    expect(cols).to.eql('`CUSTOMER`.`NAME`');
  });

  it('builds DELETE', function() {
    var sql = connector.buildDelete('customer', {name: 'John'});
    expect(sql.toJSON()).to.eql({
      sql: 'DELETE FROM `CUSTOMER` WHERE `CUSTOMER`.`NAME`=$1',
      params: ['John']
    });
  });

  it('builds UPDATE', function() {
    var sql = connector.buildUpdate('customer', {name: 'John'}, {vip: false});
    expect(sql.toJSON()).to.eql({
      sql: 'UPDATE `CUSTOMER` SET `CUSTOMER`.`VIP`=$1 WHERE `CUSTOMER`.`NAME`=$2',
      params: [false, 'John']
    });
  });

  it('builds SELECT', function() {
    var sql = connector.buildSelect('customer',
      {order: 'name', limit: 5, where: {name: 'John'}});
    expect(sql.toJSON()).to.eql({
      sql: 'SELECT `CUSTOMER`.`NAME`,`CUSTOMER`.`VIP`,`CUSTOMER`.`ADDRESS`,' +
      '`CUSTOMER`.`STORE_ID` FROM `CUSTOMER`' +
      ' WHERE `CUSTOMER`.`NAME`=$1 ORDER BY `CUSTOMER`.`NAME` LIMIT 5',
      params: ['John']
    });
  });

  it('builds INSERT', function() {
    var sql = connector.buildInsert('customer', {name: 'John', vip: true});
    expect(sql.toJSON()).to.eql({
      sql: 'INSERT INTO `CUSTOMER`(`NAME`,`VIP`) VALUES($1,$2)',
      params: ['John', true]
    });
  });

  it('normalizes a SQL statement from string', function() {
    var sql = 'SELECT * FROM `CUSTOMER`';
    var stmt = new ParameterizedSQL(sql);
    expect(stmt.toJSON()).to.eql({sql: sql, params: []});
  });

  it('normalizes a SQL statement from object without params', function() {
    var sql = {sql: 'SELECT * FROM `CUSTOMER`'};
    var stmt = new ParameterizedSQL(sql);
    expect(stmt.toJSON()).to.eql({sql: sql.sql, params: []});
  });

  it('normalizes a SQL statement from object with params', function() {
    var sql =
    {sql: 'SELECT * FROM `CUSTOMER` WHERE `NAME`=?', params: ['John']};
    var stmt = new ParameterizedSQL(sql);
    expect(stmt.toJSON()).to.eql({sql: sql.sql, params: ['John']});
  });

  it('should throw if the statement is not a string or object', function() {
    expect(function() {
      /*jshint unused:false */
      var stmt = new ParameterizedSQL(true);
    }).to.throw('sql must be a string');
  });

  it('concats SQL statements', function() {
    var stmt1 = {sql: 'SELECT * from `CUSTOMER`'};
    var where = {sql: 'WHERE `NAME`=?', params: ['John']};
    stmt1 = ParameterizedSQL.append(stmt1, where);
    expect(stmt1.toJSON()).to.eql(
      {sql: 'SELECT * from `CUSTOMER` WHERE `NAME`=?', params: ['John']});
  });

  it('concats string SQL statements', function() {
    var stmt1 = 'SELECT * from `CUSTOMER`';
    var where = {sql: 'WHERE `NAME`=?', params: ['John']};
    stmt1 = ParameterizedSQL.append(stmt1, where);
    expect(stmt1.toJSON()).to.eql(
      {sql: 'SELECT * from `CUSTOMER` WHERE `NAME`=?', params: ['John']});
  });

  it('should throw if params does not match placeholders', function() {
    expect(function() {
      var stmt1 = 'SELECT * from `CUSTOMER`';
      var where = {sql: 'WHERE `NAME`=?', params: ['John', 'Mary']};
      stmt1 = ParameterizedSQL.append(stmt1, where);
    }).to.throw('must match the number of params');
  });

  it('should allow execute(sql, callback)', function(done) {
    connector.execute('SELECT * FROM `CUSTOMER`', done);
  });

  it('should allow execute(sql, params, callback)', function(done) {
    connector.execute('SELECT * FROM `CUSTOMER` WHERE `NAME`=$1',
      ['xyz'], done);
  });

  it('should allow execute(sql, params, options, callback)', function(done) {
    connector.execute('SELECT * FROM `CUSTOMER` WHERE `NAME`=$1',
      ['xyz'], {transaction: true}, done);
  });

  it('should throw if params is not an array for execute()', function() {
    expect(function() {
      connector.execute('SELECT * FROM `CUSTOMER`', 'xyz', function() {
      });
    }).to.throw('params must be an array');
  });

  it('should throw if options is not an object for execute()', function() {
    expect(function() {
      connector.execute('SELECT * FROM `CUSTOMER`', [], 'xyz', function() {
      });
    }).to.throw('options must be an object');
  });

  it('should throw if callback is not a function for execute()', function() {
    expect(function() {
      connector.execute('SELECT * FROM `CUSTOMER`', [], {}, 'xyz');
    }).to.throw('callback must be a function');
  });

  it('should invoke hooks', function(done) {
    var events = [];
    connector.observe('before execute', function(ctx, next) {
      expect(ctx.req.sql).be.a('string');
      expect(ctx.req.params).be.a('array');
      events.push('before execute');
      next();
    });
    connector.observe('after execute', function(ctx, next) {
      expect(ctx.res).be.an('array');
      events.push('after execute');
      next();
    });
    Customer.find(function(err, results) {
      expect(events).to.eql(['before execute', 'after execute']);
      done(err, results);
    });
  });
});