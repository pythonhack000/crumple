import type { Question } from '../../shared/api';

/**
 * Built-in daily questions. Each one splits a crowd without having a "right"
 * answer, so the game is about reading people, not knowing facts.
 * Moderators can queue their own questions; these fill the days in between.
 */
export const QUESTION_BANK: readonly Question[] = [
  { prompt: 'You find a $20 bill on an empty street. You...', options: ['Keep it', 'Hand it to the police', 'Leave it there', 'Give it to the next person you see'] },
  { prompt: 'Best time of day to get real work done?', options: ['Early morning', 'Late morning', 'Afternoon', 'After midnight'] },
  { prompt: 'Which superpower would you actually use every day?', options: ['Teleporting', 'Reading minds', 'Never needing sleep', 'Pausing time'] },
  { prompt: 'The one item you save from a fire (people and pets are safe)?', options: ['Phone', 'Laptop', 'Photo albums', 'Wallet and documents'] },
  { prompt: 'How do you eat a burger that is too tall?', options: ['Squash it flat', 'Knife and fork', 'Take it apart', 'Unhinge the jaw'] },
  { prompt: 'Toilet paper roll goes...', options: ['Over', 'Under', 'On the counter, who cares'] },
  { prompt: 'Your phone battery hits 1%. First move?', options: ['Find a charger', 'Low power mode and pray', 'Let it die', 'Send one last message'] },
  { prompt: 'Where do you sit on a nearly empty bus?', options: ['Front', 'Middle', 'Back row', 'I stand'] },
  { prompt: 'Best way to spend a free rainy Sunday?', options: ['Sleep in', 'Binge a show', 'Cook something big', 'Go out anyway'] },
  { prompt: 'A friend’s cooking is bad. You...', options: ['Eat it and smile', 'Tell them kindly', 'Add hot sauce', 'Suddenly not hungry'] },
  { prompt: 'Pick a pet with zero downsides.', options: ['Dog', 'Cat', 'Parrot', 'A very calm lizard'] },
  { prompt: 'The best season?', options: ['Spring', 'Summer', 'Autumn', 'Winter'] },
  { prompt: 'Most annoying sound?', options: ['Loud chewing', 'Nails on a board', 'An alarm next door', 'Someone else’s phone call on speaker'] },
  { prompt: 'You can only keep one: which app goes last?', options: ['Messages', 'Maps', 'Music', 'Camera'] },
  { prompt: 'Hot drink of choice?', options: ['Coffee', 'Black tea', 'Green tea', 'Hot chocolate'] },
  { prompt: 'Which would you rather never do again?', options: ['Cook', 'Clean', 'Do laundry', 'Shop for groceries'] },
  { prompt: 'How do you read a long article?', options: ['Every word', 'Skim the headings', 'First paragraph only', 'Straight to the comments'] },
  { prompt: 'Time travel, one trip only.', options: ['The distant past', '100 years ago', '100 years ahead', 'The far future'] },
  { prompt: 'Your ideal holiday?', options: ['Beach', 'Mountains', 'Big city', 'Staying home'] },
  { prompt: 'Group chat with 200 unread messages. You...', options: ['Read them all', 'Scroll to the end', 'Mute it', 'Ask "what did I miss"'] },
  { prompt: 'Best pizza topping, no arguing?', options: ['Pepperoni', 'Mushrooms', 'Extra cheese', 'Pineapple'] },
  { prompt: 'How many alarms do you set in the morning?', options: ['One', 'Two or three', 'Four or more', 'I wake up on my own'] },
  { prompt: 'The first thing you notice in a new room?', options: ['The light', 'The smell', 'The people', 'Where the exits are'] },
  { prompt: 'A free plane ticket appears. You go...', options: ['Today', 'Next month', 'Next year', 'I don’t fly'] },
  { prompt: 'Which skill would you learn instantly?', options: ['A new language', 'An instrument', 'Cooking like a chef', 'Fixing anything'] },
  { prompt: 'Your stance on breakfast?', options: ['Most important meal', 'Coffee counts', 'Skip it', 'Breakfast for dinner'] },
  { prompt: 'Socks in bed?', options: ['Always', 'Only in winter', 'Never', 'They come off at 3am'] },
  { prompt: 'Movie night: who picks?', options: ['Me', 'The guest', 'Random pick', 'We scroll for an hour and give up'] },
  { prompt: 'The best kind of weather for a walk?', options: ['Sunny and warm', 'Cool and cloudy', 'Light rain', 'Fresh snow'] },
  { prompt: 'Most useful invention of all time?', options: ['The wheel', 'Electricity', 'The internet', 'Soap'] },
  { prompt: 'You can delete one thing from the world.', options: ['Mosquitoes', 'Traffic jams', 'Ads', 'Mondays'] },
  { prompt: 'How do you answer an unknown number?', options: ['Pick up', 'Let it ring', 'Text them', 'Search the number first'] },
  { prompt: 'Which would you rather have?', options: ['More money', 'More time', 'More sleep', 'More friends'] },
  { prompt: 'Favourite way to listen to music?', options: ['Headphones', 'Speakers, loud', 'In the car', 'Live'] },
  { prompt: 'The best snack at 2am?', options: ['Cereal', 'Leftovers', 'Something sweet', 'Toast'] },
  { prompt: 'Your desk right now is...', options: ['Spotless', 'Organised chaos', 'Buried', 'What desk?'] },
  { prompt: 'Which chore is secretly relaxing?', options: ['Washing dishes', 'Folding clothes', 'Vacuuming', 'None of them'] },
  { prompt: 'You win a lifetime supply of one thing.', options: ['Coffee', 'Books', 'Flights', 'Pizza'] },
  { prompt: 'The perfect number of people at a party?', options: ['Two', 'Five to ten', 'Twenty-ish', 'The more the better'] },
  { prompt: 'Which animal would win a fight with a human?', options: ['Goose', 'Kangaroo', 'Chimpanzee', 'House cat'] },
  { prompt: 'How do you take notes?', options: ['Paper', 'Phone', 'Laptop', 'I just remember'] },
  { prompt: 'Best way to make a hard decision?', options: ['Sleep on it', 'Flip a coin', 'Ask a friend', 'Make a list'] },
  { prompt: 'Which would you give up for a year?', options: ['Sugar', 'Social media', 'Coffee', 'Streaming'] },
  { prompt: 'A song is stuck in your head. You...', options: ['Play it', 'Play something else', 'Hum it all day', 'Suffer quietly'] },
  { prompt: 'Your living-space dream?', options: ['City flat', 'House with a garden', 'Cabin in the woods', 'House by the sea'] },
];

/** Picks the built-in question for a day number, cycling through the bank. */
export function bankQuestionFor(dayNumber: number): Question {
  const index = ((dayNumber % QUESTION_BANK.length) + QUESTION_BANK.length) % QUESTION_BANK.length;
  const question = QUESTION_BANK[index];
  if (!question) throw new Error('Question bank is empty');
  return question;
}
