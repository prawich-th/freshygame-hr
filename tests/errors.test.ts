import assert from 'node:assert/strict';
import { ConvexError } from 'convex/values';
import { errorMessage, UserFacingError } from '../app/lib/errors';
import { test } from 'node:test';

test('explains expected failures and hides internal error details', () => {
assert.match(errorMessage(new ConvexError('Read-only access')), /viewer access/);
assert.match(errorMessage(new ConvexError('Upload session expired')), /Start verification again/);
assert.equal(errorMessage(new UserFacingError('Row 4: Name is missing.')), 'Row 4: Name is missing.');
assert.match(errorMessage(new Error('[CONVEX A(auth:signIn)] InvalidSecret')), /email or password is incorrect/);
assert.match(errorMessage(new TypeError('Failed to fetch'), 'Upload images'), /connection was interrupted/);
const unexpected = errorMessage(new Error('[CONVEX M(participants:create)] Server Error\n at private/file.ts:123'), 'Create participant');
assert.match(unexpected, /unexpected problem/);
assert.doesNotMatch(unexpected, /CONVEX|private|Server Error/);


});
