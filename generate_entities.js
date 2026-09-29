const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('schema.json', 'utf8'));

const moduleMap = {
  alerta: 'alertas',
  area: 'geocercas',
  zona_trabajo: 'geocercas',
  auditoria_geocerca: 'geocercas',
  asignacion_gps: 'maquinas',
  dispositivo_gps: 'maquinas',
  maquina: 'maquinas',
  estado_operacional: 'turnos',
  evidencia: 'evidencias',
  reporte_turno: 'evidencias',
  operador: 'operadores',
  tracking_history: 'tracking',
  turno: 'turnos',
  turno_estado: 'turnos',
  turno_ubicacion: 'turnos',
  usuario: 'usuarios'
};

function getTsType(dataType) {
  if (dataType.includes('int') || dataType === 'numeric') return 'number';
  if (dataType.includes('timestamp') || dataType === 'date') return 'Date';
  if (dataType === 'boolean') return 'boolean';
  if (dataType === 'jsonb') return 'any';
  return 'string'; // varchar, text, USER-DEFINED (geometry)
}

function getColumnDecorator(dataType) {
  if (dataType === 'integer') return "'integer'";
  if (dataType === 'bigint') return "'bigint'";
  if (dataType === 'numeric') return "'numeric'";
  if (dataType === 'boolean') return "'boolean'";
  if (dataType === 'date') return "'date'";
  if (dataType.includes('timestamp')) return "'timestamp with time zone'";
  if (dataType === 'text') return "'text'";
  if (dataType === 'jsonb') return "'jsonb'";
  if (dataType === 'USER-DEFINED') return "'geometry'"; // Assuming PostGIS
  return "'varchar'"; // fallback
}

for (const [tableName, columns] of Object.entries(schema)) {
  const moduleName = moduleMap[tableName];
  if (!moduleName) continue;
  
  let className = tableName.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('') + 'OrmEntity';
  let fileContent = `import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';\n\n@Entity('${tableName}')\nexport class ${className} {\n`;
  
  for (const col of columns) {
    const isPk = col.column_name.startsWith('id_') && col.column_name === `id_${tableName}`; // approximation
    const isNullable = col.is_nullable === 'YES';
    const tsType = getTsType(col.data_type) + (isNullable ? ' | null' : '');
    const colDecorator = getColumnDecorator(col.data_type);
    
    let options = `{ name: '${col.column_name}'${isNullable ? ', nullable: true' : ''} }`;
    
    if (isPk) {
      fileContent += `  @PrimaryGeneratedColumn(${options})\n`;
    } else {
      fileContent += `  @Column(${colDecorator}, ${options})\n`;
    }
    fileContent += `  ${col.column_name}: ${tsType};\n\n`;
  }
  
  fileContent += `}\n`;
  
  const dir = `src/modules/${moduleName}/infrastructure/persistence/orm-entities`;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(`${dir}/${tableName.replace(/_/g, '-')}.orm-entity.ts`, fileContent);
}

// Generate module files
for (const m of [...new Set(Object.values(moduleMap))]) {
  if (m === 'turnos') continue; // already done
  
  const moduleClassName = m.charAt(0).toUpperCase() + m.slice(1) + 'Module';
  const fileContent = `import { Module } from '@nestjs/common';\nimport { TypeOrmModule } from '@nestjs/typeorm';\n\n@Module({\n  imports: [TypeOrmModule.forFeature([])],\n  controllers: [],\n  providers: [],\n  exports: [],\n})\nexport class ${moduleClassName} {}\n`;
  
  fs.writeFileSync(`src/modules/${m}/${m}.module.ts`, fileContent);
}

