// Royalty-free crop photos (credits in public/CREDITS.md), keyed by reference crop id. Crops without a photo
// fall back to their icon wherever a photo would show.
export const CROP_PHOTOS: Partial<Record<string, string>> = {
  wheat: '/photos/crop-wheat.jpg',
  mustard: '/photos/crop-mustard.jpg',
  cotton: '/photos/crop-cotton.jpg',
  tomato: '/photos/crop-tomato.jpg',
  rice: '/photos/crop-rice.jpg',
};
