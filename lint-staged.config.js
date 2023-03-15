module.exports = {
  '**/*.{js,ts,tsx}': () => 'eslint --fix --cache',
  '**/*.ts?(x)': () => 'tsc -p tsconfig.json --noEmit --composite false',
}
