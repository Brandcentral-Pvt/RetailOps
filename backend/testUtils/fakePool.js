/**
 * Fake MSSQL pool for controller/route tests.
 *
 * `request()` returns a chainable mssql-style request. Every `.query(sql)`
 * is recorded (text + bound inputs) and dispatched against a list of
 * { match, rows } routes — the first matching regex wins; unmatched
 * queries return an empty recordset.
 */
const FAKE_SQL = {
    VarChar: 'VarChar',
    NVarChar: 'NVarChar',
    Int: 'Int',
    Date: 'Date',
    Bit: 'Bit',
    UniqueIdentifier: 'UniqueIdentifier',
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
