import fs from 'fs';

let content = fs.readFileSync('src/pages/employee/EmployeeMaster.tsx', 'utf8');

// replace the basic invokeCommand for list views
content = content.replace(/invokeCommand<any\[\]>\('master_crud', \{ tableName: '([^']+)', operation: 'list', moduleType: currentMode, _v: ts \}\)\.catch\(\(\) => \[\]\)/g, 
"fetchApi<any[]>(`/api/master-data/$1?module_type=\${currentMode}&_v=\${ts}`).catch(() => [])");

// same for 'P' module
content = content.replace(/invokeCommand<SalarySlab\[\]>\('master_crud', \{ tableName: '([^']+)', operation: 'list', moduleType: 'P', _v: ts \}\)\.catch\(\(\) => \[\]\)/g, 
"fetchApi<SalarySlab[]>(`/api/master-data/$1?module_type=P&_v=\${ts}`).catch(() => [])");

content = content.replace(/invokeCommand<SalaryHead\[\]>\('master_crud', \{ tableName: '([^']+)', operation: 'list', moduleType: 'P', _v: ts \}\)\.catch\(\(\) => \[\]\)/g, 
"fetchApi<SalaryHead[]>(`/api/master-data/$1?module_type=P&_v=\${ts}`).catch(() => [])");

// replace manual id settings fetch
content = content.replace(/invokeCommand<any>\('master_crud', \{ tableName: 'settings', operation: 'get', id: '([^']+)', moduleType: currentMode, _v: ts \}\)\.catch\(\(\) => \(\{ value: '0' \}\)\)/g, 
"fetchApi<any>(`/api/master-data/settings/$1?module_type=\${currentMode}&_v=\${ts}`).catch(() => ({ value: '0' }))");

// replace the main loading of employees
content = content.replace(/const result = await invokeCommand<any>\('master_crud', \{ \n\s*tableName: 'employees',\n\s*operation: 'list',\n\s*moduleType: currentMode,\n\s*limit: 50,\n\s*offset: \(page - 1\) \* 50,\n\s*filters\n\s*\}\);/g, 
"// Construct query params from filters\n      const queryParams = new URLSearchParams({\n        module_type: currentMode,\n        limit: '50',\n        offset: String((page - 1) * 50)\n      });\n      if (filters) {\n        Object.entries(filters).forEach(([k, v]) => {\n          if (v) queryParams.append(k, String(v));\n        });\n      }\n      const result = await fetchApi<any>(`/api/employees?${queryParams.toString()}`);");


// update employees creation and update
content = content.replace(/await invokeCommand\('master_crud', \{\n\s*tableName: 'employees',\n\s*operation: 'create',\n\s*data: formData,\n\s*moduleType: currentMode\n\s*\}\);/g, 
"await fetchApi('/api/employees', {\n        method: 'POST',\n        headers: {\n          'Content-Type': 'application/json',\n          'x-module-type': currentMode\n        },\n        body: JSON.stringify(formData)\n      });");

content = content.replace(/await invokeCommand\('master_crud', \{\n\s*tableName: 'employees',\n\s*operation: 'update',\n\s*id: formData\.id,\n\s*data: updatePayload,\n\s*moduleType: currentMode\n\s*\}\);/g, 
"await fetchApi(`/api/employees/${formData.id}`, {\n        method: 'PUT',\n        headers: {\n          'Content-Type': 'application/json',\n          'x-module-type': currentMode\n        },\n        body: JSON.stringify(updatePayload)\n      });");


// delete employee
content = content.replace(/await invokeCommand\('master_crud', \{\n\s*tableName: 'employees',\n\s*operation: 'update',\n\s*id: empToDelete,\n\s*data: \{ status: 'Resigned' \},\n\s*moduleType: currentMode\n\s*\}\);/g, 
"await fetchApi(`/api/employees/${empToDelete}`, {\n        method: 'PUT',\n        headers: {\n          'Content-Type': 'application/json',\n          'x-module-type': currentMode\n        },\n        body: JSON.stringify({ status: 'Resigned' })\n      });");

fs.writeFileSync('src/pages/employee/EmployeeMaster.tsx', content);

