import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/plan', () => {
    return HttpResponse.json({
      focusTarget: 4,
      garden: [
        { name: 'Tomato beds', note: 'Two ripe tomatoes ready for harvest', status: 'Growing' },
        { name: 'Mint patch', note: 'Refreshing and bright', status: 'Thriving' },
        { name: 'Carrot row', note: 'Slow but steady', status: 'Sprouting' },
      ],
      tips: ['Water the task list before each sprint.', 'Take one deep breath between rounds.', 'Plant one small win first.'],
    });
  }),
];
