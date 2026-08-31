import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { compile } from 'json-schema-to-typescript';
import { format, resolveConfig } from 'prettier';

const root = process.cwd();
const checkOnly = process.argv.slice(2).includes('--check');
if (process.argv.slice(2).some((argument) => argument !== '--check')) {
  throw new Error('Unsupported contract-generation argument. Use --check or no arguments.');
}
const schemas = [
  ['calculator-version.v1.schema.json', 'CalculatorVersionV1'],
  ['measurement-definition.v1.schema.json', 'MeasurementDefinitionV1'],
  ['content-page.v1.schema.json', 'ContentPageV1'],
];

for (const [fileName, typeName] of schemas) {
  const schemaPath = join(root, 'packages', 'contracts', 'schemas', fileName);
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  if (fileName === 'calculator-version.v1.schema.json') {
    const content = JSON.parse(
      await readFile(
        join(root, 'packages', 'contracts', 'schemas', 'content-page.v1.schema.json'),
        'utf8',
      ),
    );
    schema.$defs = { ...(schema.$defs ?? {}), ...(content.$defs ?? {}) };
    const inlineExternalRefs = (value) => {
      if (Array.isArray(value)) return value.map(inlineExternalRefs);
      if (value && typeof value === 'object') {
        if (value.$ref === 'urn:niro:schema:content-page:v1') return inlineExternalRefs(content);
        return Object.fromEntries(
          Object.entries(value).map(([key, child]) => [key, inlineExternalRefs(child)]),
        );
      }
      return value;
    };
    Object.assign(schema, inlineExternalRefs(schema));
  }
  const generatedSource = await compile(schema, typeName, {
    bannerComment: `/** Generated from ${fileName}; edit the canonical JSON Schema instead. */`,
    style: { semi: true, singleQuote: true },
  });
  const outputPath = join(
    root,
    'packages',
    'contracts',
    'src',
    'generated',
    `${fileName.replace('.schema.json', '')}.ts`,
  );
  const source = await format(generatedSource, {
    ...((await resolveConfig(outputPath)) ?? {}),
    filepath: outputPath,
  });
  if (checkOnly) {
    const committed = await readFile(outputPath, 'utf8').catch(() => undefined);
    if (committed !== source) {
      throw new Error(`Generated contract artifact is stale: ${outputPath}`);
    }
    console.log(`checked ${outputPath}`);
  } else {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, source, 'utf8');
    console.log(`generated ${outputPath}`);
  }
}
