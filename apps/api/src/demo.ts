/** One seeded account per role. Phone numbers use the reserved-looking 90000 0000x range. */
export const DEMO_ACCOUNTS = [
  { role: 'farmer', name: 'Ramesh Wankhede', phone: '+919000000001', districtId: 'nagpur' },
  { role: 'officer', name: 'Anita Deshmukh', phone: '+919000000002', districtId: 'nagpur' },
  { role: 'admin', name: 'Vikram Rao', phone: '+919000000003', districtId: null },
] as const;
