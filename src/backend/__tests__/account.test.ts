import { boardNameFrom } from '../account';

describe('the leaderboard name taken from an account', () => {
  it('is the first name and the last initial, never the whole name', () => {
    expect(boardNameFrom('Maris Denis')).toBe('Maris D.');
    expect(boardNameFrom('  ana  maria  popescu ')).toBe('ana P.');
    expect(boardNameFrom('Cher')).toBe('Cher');
  });

  it('is nothing when there is no usable name', () => {
    expect(boardNameFrom(null)).toBeNull();
    expect(boardNameFrom('   ')).toBeNull();
    expect(boardNameFrom('X')).toBeNull();
  });
});
