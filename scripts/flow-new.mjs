// Создаёт новый флоу из шаблона screens/_starter/flow. Адрес: /screens/<адрес>/ (после запуска npm run dev заново).
// Запуск: npm run flow:new -- "Название флоу" [--slug my-flow]
import { cp, readFile, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const LETTERS = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
export const slugify = name => name.toLowerCase().replace(/[а-яё]/g, c => LETTERS[c]).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const exists = path => access(path).then(() => true, () => false);
const js = text => text.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const html = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export async function createFlow({ name, slug, projectRoot = root }) {
  name = name?.trim();
  if (!name) throw new Error('Укажите название: npm run flow:new -- "Название флоу"');
  slug = slug || slugify(name);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error(`Не удалось получить адрес из названия «${name}». Передайте его явно: --slug my-flow`);
  const target = join(projectRoot, 'screens', slug);
  if (slug.startsWith('_') || await exists(target)) throw new Error(`Папка screens/${slug} уже существует. Выберите другой адрес: --slug <имя>`);

  await cp(join(projectRoot, 'screens/_starter/flow'), target, { recursive: true });
  const edit = async (file, change) => { const path = join(target, file); await writeFile(path, change(await readFile(path, 'utf8'))); };
  // Папка лежит на уровень выше шаблона, поэтому импорты короче на один «../».
  await edit('entry.js', s => s.replace(/^\/\*[\s\S]*?\*\/\n/, `/* ${js(name)}. Общая оболочка: screens/shell. Как устроен флоу: /screens/guide/new-flow/ */\n`)
    .replaceAll('../../', '../').replace("'Название флоу'", `'${js(name)}'`)
    .replace('/screens/_starter/flow/', `/screens/${slug}/`).replace('resetKeys: [], ', `resetKeys: ['${slug}-draft'],`));
  await edit('solution.js', s => s.replaceAll('../../', '../'));
  await edit('index.html', s => s.replace('Новый флоу', html(name)));

  return { slug, url: `/screens/${slug}/`, directory: `screens/${slug}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const at = args.indexOf('--slug');
  const slug = at >= 0 ? args.splice(at, 2)[1] : undefined;
  try {
    const result = await createFlow({ name: args.join(' '), slug });
    console.log(`Готово: ${result.directory}\nАдрес: http://127.0.0.1:5173${result.url} (npm run dev, перезапустите, если он уже запущен)\nДальше: экран в ${result.directory}/solution.js, тексты в ${result.directory}/content.js`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
