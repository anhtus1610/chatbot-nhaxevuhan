const data = require('../knowledge/prices.json');
const routes = [...new Set(data.map(p => p.route))];
console.log('Total entries:', data.length);
console.log('Routes:', JSON.stringify(routes));
routes.forEach(r => {
  const count = data.filter(p => p.route === r).length;
  const vehicles = [...new Set(data.filter(p => p.route === r).map(p => p.vehicle))];
  console.log('  ' + r + ': ' + count + ' entries, vehicles: ' + vehicles.join(', '));
});
