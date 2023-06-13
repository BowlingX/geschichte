cat >build/cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF

cp ./build/mjs/lib/adapters/nextjs/index.d.ts nextjs.d.ts
cp ./build/mjs/lib/adapters/historyjs/index.d.ts historyjs.d.ts
cp ./build/mjs/lib/adapters/static/index.d.ts static.d.ts
cp ./build/mjs/lib/adapters/nextjs-app-router/index.d.ts nextjs-app-router.d.ts
