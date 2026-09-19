/**
 * Fake MSSQL pool for controller/route tests.
 *
 * `request()` returns a chainable mssql-style request. Every `.query(sql)`
 * is recorded (text + bound inputs) and dispatched against a list of
 * { match, rows } routes — the first matching regex wins; unmatched
 * queries return an empty recordset.
 */
/**
 * Type markers double as factories: `sql.VarChar` can be passed as a value and
 * `sql.Decimal(18, 2)` can be called, mirroring the real `mssql` namespace.
 */
const typeFactory = (name) => {
    const fn = (lengthOrPrecision, scale) => ({ type: name, length: lengthOrPrecision, precision: lengthOrPrecision, scale });
    fn.type = name;
    fn.toString = () => name;
    return fn;
};

const FAKE_SQL = {
    VarChar: typeFactory('VarChar'),
    NVarChar: typeFactory('NVarChar'),
    Int: typeFactory('Int'),
    BigInt: typeFactory('BigInt'),
    Decimal: typeFactory('Decimal'),
    Float: typeFactory('Float'),
    Date: typeFactory('Date'),
    DateTime: typeFactory('DateTime'),
    Bit: typeFactory('Bit'),
    UniqueIdentifier: typeFactory('UniqueIdentifier'),
};

function makeFakePool(routes = []) {
    const calls = [];

    const makeRequest = () => {
        const req = {
            _inputs: {},
            input(name, type, value) {
                // mssql signature: input(name, type, value) — tolerate 2-arg calls
                this._inputs[name] = value === undefined ? type : value;
                return this;
            },
            async query(sqlText) {
                const entry = { sql: sqlText, inputs: { ...this._inputs } };
                calls.push(entry);
                for (const route of routes) {
                    if (route.match.test(sqlText)) {
                        const rows = typeof route.rows === 'function'
                            ? route.rows(entry)
                            : (route.rows || []);
                        return { recordset: rows, rowsAffected: [rows.length] };
                    }
                }
                return { recordset: [], rowsAffected: [0] };
            },
        };
        return req;
    };

    return {
        calls,
        request: makeRequest,
        /** Find the first captured query whose SQL matches `re`. */
        callWhere(re) {
            return calls.find(c => re.test(c.sql)) || null;
        },
        /** All captured queries whose SQL matches `re`. */
        callsWhere(re) {
            return calls.filter(c => re.test(c.sql));
        },
    };
}

module.exports = { makeFakePool, FAKE_SQL };
