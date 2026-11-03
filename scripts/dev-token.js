import jwt from 'jsonwebtoken';

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET wajib diisi.');
  process.exit(1);
}
const role = (process.argv[2] ?? 'PETANI').toUpperCase();
const token = jwt.sign({ sub: `dev-${role.toLowerCase()}`, role }, process.env.JWT_SECRET, { expiresIn: '8h' });
console.log(token);
console.log(`\nBuka peta: http://localhost:${process.env.PORT ?? 3003}/#token=${token}`);
