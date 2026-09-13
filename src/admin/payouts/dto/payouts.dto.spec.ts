import { CreatePayoutSchema } from './payouts.dto';

describe('CreatePayoutSchema', () => {
  it('rejects amounts below the 500 minimum', () => {
    const result = CreatePayoutSchema.safeParse({ amount: 499 });
    expect(result.success).toBe(false);
  });

  it('accepts the 500 minimum', () => {
    expect(CreatePayoutSchema.parse({ amount: 500 })).toEqual(
      expect.objectContaining({ amount: 500 }),
    );
  });
});
