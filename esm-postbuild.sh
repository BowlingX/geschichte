cat >build/cjs/package.json <<!EOF
{
    "type": "commonjs"
}
!EOF

cat >build/mjs/package.json <<!EOF
{
    "type": "module"
}
!EOF


cp ./build/mjs/lib/adapters/nextjs/index.d.ts nextjs.d.ts
cp ./build/mjs/lib/adapters/historyjs/index.d.ts historyjs.d.ts
