/**
 * Script kiểm tra KnowledgeService đọc dữ liệu từ Markdown
 */
const path = require('path');

// Quick MD price parser test
function testMdPriceParser() {
  const fs = require('fs');
  const tablesDir = path.join(__dirname, '../knowledge/operators/vu_han/route/ticket_fares__tables');
  
  let totalEntries = 0;
  const files = fs.readdirSync(tablesDir).filter(f => f.endsWith('.md'));
  
  console.log('=== Markdown Price Tables ===');
  console.log('Files found:', files.length);
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(tablesDir, file), 'utf-8');
    
    // Count table rows (lines starting with | that have price data)
    const dataRows = content.split('\n').filter(line => {
      const trimmed = line.trim();
      if (!trimmed.startsWith('|')) return false;
      if (trimmed.startsWith('| Điểm đi') || trimmed.startsWith('|Điểm đi')) return false;
      if (trimmed.match(/^\|[-:\s|]+\|$/)) return false;
      // Must have at least 3 cells with a number in the last
      const cells = trimmed.split('|').map(c => c.trim()).filter(c => c.length > 0);
      return cells.length >= 3 && cells[2].match(/\d/);
    });
    
    totalEntries += dataRows.length;
    console.log('  ' + file + ': ' + dataRows.length + ' entries');
  }
  
  console.log('\nTotal entries in MD tables: ' + totalEntries);
  console.log('Expected (from prices.json): 7796');
  console.log(totalEntries === 7796 ? '✅ MATCH!' : '❌ MISMATCH! Diff: ' + (7796 - totalEntries));
}

// Test schedule MD
function testScheduleMd() {
  const fs = require('fs');
  const schedulePath = path.join(__dirname, '../knowledge/operators/vu_han/route/schedules.md');
  
  console.log('\n=== Schedule Markdown ===');
  
  if (fs.existsSync(schedulePath)) {
    const content = fs.readFileSync(schedulePath, 'utf-8');
    const lines = content.split('\n').length;
    console.log('  schedules.md: ' + lines + ' lines');
    
    // Check key data points from BA
    const checks = [
      { test: 'Xín Mần giờ 05:30', found: content.includes('05:30') },
      { test: 'Xín Mần giờ 10:00', found: content.includes('10:00') },
      { test: 'Xín Mần giờ 19:20', found: content.includes('19:20') },
      { test: 'Đồng Văn giờ 19:30', found: content.includes('19:30') },
      { test: 'Mèo Vạc giờ 18:30', found: content.includes('18:30') },
      { test: 'Tuyên Quang 06:20', found: content.includes('06:20') },
      { test: 'Tuyên Quang 06:55', found: content.includes('06:55') },
      { test: 'Tuyên Quang 07:50', found: content.includes('07:50') },
      { test: 'Tuyên Quang 15:25', found: content.includes('15:25') },
      { test: 'Tuyên Quang 17:50', found: content.includes('17:50') },
      { test: 'SĐT xe 0346152828', found: content.includes('0346152828') },
      { test: 'SĐT xe 0347002828', found: content.includes('0347002828') },
    ];
    
    for (const check of checks) {
      console.log('  ' + (check.found ? '✅' : '❌') + ' ' + check.test);
    }
  } else {
    console.log('  ❌ schedules.md not found!');
  }
}

// Test new file structure matches BA Appendix B
function testFileStructure() {
  const fs = require('fs');
  const root = path.join(__dirname, '../knowledge/operators/vu_han');
  
  console.log('\n=== File Structure (BA Appendix B) ===');
  
  const expectedFiles = [
    'operator.json',
    'route/bus_route.md',
    'route/limousine_route.md',
    'route/bus_office_mapping.md',
    'route/schedules.md',
    'route/ticket_fares__tables',
    'faq/general_faq.md',
    'common/offices.md',
    'common/phone_numbers.md',
    'common/aliases.md',
    'common/policies.md',
  ];
  
  for (const f of expectedFiles) {
    const fullPath = path.join(root, f);
    const exists = fs.existsSync(fullPath);
    console.log('  ' + (exists ? '✅' : '❌') + ' ' + f);
  }
}

testMdPriceParser();
testScheduleMd();
testFileStructure();
