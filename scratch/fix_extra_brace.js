const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const servicesDir = path.resolve(__dirname, '../services');
const files = fs.readdirSync(servicesDir);

let fixed = 0;
files.forEach(f => {
  if (!f.endsWith('.js')) return;
  const full = path.join(servicesDir, f);
  let content = fs.readFileSync(full, 'utf8');

  if (content.includes('      });\n      }\n    } catch (e) {')) {
    content = content.replace(/      \}\);\n      \}\n    \} catch \(e\) \{/g, '      });\n    } catch (e) {');
    fs.writeFileSync(full, content, 'utf8');
    fixed++;
  } else if (content.includes('      });\r\n      }\r\n    } catch (e) {')) {
    content = content.replace(/      \}\);\r\n      \}\r\n    \} catch \(e\) \{/g, '      });\r\n    } catch (e) {');
    fs.writeFileSync(full, content, 'utf8');
    fixed++;
  }

  try {
    execSync(`node -c "${full}"`);
    console.log(`✅ OK: ${f}`);
  } catch (err) {
    console.error(`❌ Syntax error: ${f} ->`, err.message);
  }
});
console.log(`Fixed ${fixed} files.`);
