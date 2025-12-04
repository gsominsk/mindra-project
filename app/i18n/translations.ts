export const translations = {
    en: {
        home: {
            est: "EST. 2024",
            title: ["The", "Event Host"],
            playReel: "PLAY REEL",
            bookNow: "BOOK NOW",
            nav: {
                home: "HOME",
                party: "PARTY",
                business: "BUSINESS",
                wedding: "WEDDING",
                contact: "CONTACT",
            },
        },
        modal: {
            title: "GET IN TOUCH",
            subtitle: "Tell us about your event.",
            nameLabel: "NAME",
            namePlaceholder: "Your Name",
            contactLabel: "CONTACT",
            contactPlaceholder: "Email or Phone",
            sendButton: "SEND REQUEST",
        },
        contact: {
            back: "BACK",
            title: ["Get in", "Touch"],
            emailLabel: "EMAIL",
            phoneLabel: "PHONE",
            form: {
                namePlaceholder: "Your Name",
                datePlaceholder: "Date",
                typePlaceholder: "Event Type",
                detailsPlaceholder: "Details...",
                sendButton: "SEND REQUEST",
                types: {
                    default: "Event Type",
                    party: "Party",
                    business: "Business",
                    wedding: "Wedding",
                }
            }
        }
    },
    uk: {
        home: {
            est: "ЗАСН. 2024",
            title: ["Ведучий", "Ваших", "Подій"],
            playReel: "ДИВИТИСЬ ВІДЕО",
            bookNow: "ЗАБРОНЮВАТИ",
            nav: {
                home: "ГОЛОВНА",
                party: "ВЕЧІРКА",
                business: "БІЗНЕС",
                wedding: "ВЕСІЛЛЯ",
                contact: "КОНТАКТИ",
            },
        },
        modal: {
            title: "ЗВ'ЯЖІТЬСЯ З НАМИ",
            subtitle: "Розкажіть про вашу подію.",
            nameLabel: "ІМ'Я",
            namePlaceholder: "Ваше Ім'я",
            contactLabel: "КОНТАКТИ",
            contactPlaceholder: "Email або Телефон",
            sendButton: "НАДІСЛАТИ ЗАПИТ",
        },
        contact: {
            back: "НАЗАД",
            title: ["Зв'яжіться з нами"],
            emailLabel: "EMAIL",
            phoneLabel: "ТЕЛЕФОН",
            form: {
                namePlaceholder: "Ваше Ім'я",
                datePlaceholder: "Дата",
                typePlaceholder: "Тип Події",
                detailsPlaceholder: "Деталі...",
                sendButton: "НАДІСЛАТИ ЗАПИТ",
                types: {
                    default: "Тип Події",
                    party: "Вечірка",
                    business: "Бізнес",
                    wedding: "Весілля",
                }
            }
        }
    }
};

export type Language = "en" | "uk";
