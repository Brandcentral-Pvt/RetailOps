/**
 * Route-order regression guard.
 *
 * GET /api/tasks must be owned by taskRoutes (the Tasks-table contract).
 * growthExecutionRoutes used to declare a duplicate GET /tasks that shadowed
 * it when mounted first — that duplicate has been removed from the router,
 * and the mount order below pins the server wiring.
 */
const fs = require('fs');
const path = require('path');

const serverSrc = fs.readFileSync(path.join(__dirname, '../../server.js'), 'utf8');
const growthRouterSrc = fs.readFileSync(
    path.join(__dirname, '../../routes/growthExecutionRoutes.js'),
    'utf8'
);

describe('server route precedence', () => {
    test('/api/tasks is mounted explicitly by taskRoutes', () => {
        expect(serverSrc).toContain("app.use('/api/tasks', taskRoutes)");
    });

    test('growthExecutionRoutes is mounted AFTER taskRoutes', () => {
        const taskMount = serverSrc.indexOf("app.use('/api/tasks', taskRoutes)");
        const growthMount = serverSrc.indexOf("app.use('/api', growthExecutionRoutes)");
        expect(taskMount).toBeGreaterThan(-1);
        expect(growthMount).toBeGreaterThan(-1);
        expect(growthMount).toBeGreaterThan(taskMount);
    });

    test('growthExecutionRoutes no longer declares GET /tasks', () => {
        expect(growthRouterSrc).not.toMatch(/router\.get\(\s*['"]\/tasks['"]/);
    });

    test('asinRoutes literal paths are declared above GET /:id', () => {
        // `/asin-tracker`-style literal routes shadow easily: router.get('/:id')
        // is the last route in asinRoutes and would swallow /facets, /views and
        // /column-preferences if any of them were registered after it.
        const asinRouterSrc = fs.readFileSync(
            path.join(__dirname, '../../routes/asinRoutes.js'),
            'utf8'
        );
        const idRoute = asinRouterSrc.lastIndexOf("router.get('/:id'");
        expect(idRoute).toBeGreaterThan(-1);

        for (const literal of ["'/facets'", "'/views'", "'/views/:id'", "'/column-preferences'"]) {
            expect(asinRouterSrc.indexOf(literal)).toBeGreaterThan(-1);
            expect(asinRouterSrc.indexOf(literal)).toBeLessThan(idRoute);
        }
    });

    test('growthExecutionRoutes mounts after the last feature router', () => {
        const growthMount = serverSrc.indexOf("app.use('/api', growthExecutionRoutes)");
        const keywordAnalysisMount = serverSrc.indexOf("app.use('/api/keyword-analysis', keywordAnalysisRoutes)");
        expect(keywordAnalysisMount).toBeGreaterThan(-1);
        expect(growthMount).toBeGreaterThan(keywordAnalysisMount);
    });
});
