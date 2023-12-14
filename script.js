// მომხმარებელს შეყავს სამკუთხედის გვერდები, თქვენ უნდა დაადგინოთ იარსებებს თუ არა ასეთი სამკუთხედი(სამკუთხედი შეიძლება არსებობდეს თუ მისი ნებისმიერი ორი გვერდის სიგრძეების ჯამი მეტია მესამეზე)


//1) მომხმარებელს შეყავს სამკუთხედის გვერდები,
// თქვენ უნდა დაადგინოთ იარსებებს თუ არა ასეთი სამკუთხედი
// (სამკუთხედი შეიძლება არსებობდეს თუ მისი ნებისმიერი ორი გვერდის სიგრძეების ჯამი მეტია მესამეზე)

// let a = prompt ("შეიყვანეთ სამკუთხედის პირველი გვერდის ზომა") ;
// let b = prompt ("შეიყვანეთ სამკუთხედის მეორე გვერდის ზომა") ;
// let c = prompt ("შეიყვანეთ სამკუთხედის მესამე გვერდის ზომა") ;


// if (a + b > c && a + c > b && b + c > a) {
//     console.log('სამკუთხედი არსებობს');
//     window.alert('სამკუთხედი არსებობს');
// } else {
//     console.log('სამკუთხედი  არ არსებობს');
//     window.alert('სამკუთხედი  არ არსებობს');
// }   


// ეს არის Chat GPT ზე მოთოვნილი გაუმჯობესებული კოდი :))


// // Get input for the first side of the triangle and validate it
// let sideA = parseFloat(prompt("Enter the length of the first side of the triangle"));
// while (isNaN(sideA) || sideA <= 0) {
//     sideA = parseFloat(prompt("Invalid input. Please enter a valid number greater than 0 for the first side"));
// }

// // Get input for the second side of the triangle and validate it
// let sideB = parseFloat(prompt("Enter the length of the second side of the triangle"));
// while (isNaN(sideB) || sideB <= 0) {
//     sideB = parseFloat(prompt("Invalid input. Please enter a valid number greater than 0 for the second side"));
// }

// // Get input for the third side of the triangle and validate it
// let sideC = parseFloat(prompt("Enter the length of the third side of the triangle"));
// while (isNaN(sideC) || sideC <= 0) {
//     sideC = parseFloat(prompt("Invalid input. Please enter a valid number greater than 0 for the third side"));
// }

// // Check if the entered values form a valid triangle
// if (sideA + sideB > sideC && sideA + sideC > sideB && sideB + sideC > sideA) {
//     console.log('Triangle exists');
//     window.alert('The triangle exists.');
// } else {
//     console.log('Triangle does not exist');
//     window.alert('The triangle does not exist. Please enter valid side lengths.');
// }


//  2) მომხმარებელს შეყავს სამი რიცხვი. თქვენ უნდა დაადგინოთ არის თუ არა პირველი რივცხვი
// // მოთავსებული მეორეს და მესამეს შორის

// const firstNumber = +prompt('შეიყვანე პირველი რიცხვი')
// const secondNumber = +prompt('შეიყვანე მეორე რიცხვი')
// const thirdNumber = +prompt('შეიყვანე მესამე რიცხვი')

// const firstText = 'პირველი რიცხვი მოთავსებულია მეორესა და მესამე რიცხვებს შორის'
// const secondText = 'პირველი რიცხვი არ არის მოთავსებული მეორესა და მესამე რიცხვებს შორის'

// if (firstNumber > secondNumber && firstNumber < thirdNumber) {
//     console.log(firstText);
// } else {
//     console.log(secondText);
// }



// 3) მომხმარებელს შეყავს წელი. თქვენ უნდა დაადგინოთ არის თუ არა ეს წელი ნაკიანი.(წელი ნაკიანია თუ ის უნაშთოდ იყოფა 4ზე და არ იყოფა უნაშთოდ 100ზე, ან უნაშთოდ იყოფა 400ზე)

let year = +prompt('შეიყვანე შენი დაბადების წელიწადი')

if ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) {
console.log(year +  " is leap year ") 
} else {
    console.log(year +  " is not a leap year ");
}
