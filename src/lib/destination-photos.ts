/**
 * A photograph of each active country's capital, for the homepage
 * destination tiles.
 *
 * Real photographs, not generated ones: the site sends patients to real
 * places, and a picture of a city that doesn't look like that city is a small
 * lie at the top of the page. All come from Wikimedia Commons under licences
 * that allow commercial use; the CC BY and CC BY-SA ones require the credit
 * the tile shows. Files live in public/destinations/{CODE}.webp (1000px wide).
 *
 * Keyed by country code but optional by design: a country an admin switches
 * on without a photo here simply gets the plain navy tile.
 */
export type DestinationPhoto = {
  /** Public path of the image. */
  src: string;
  city: string;
  author: string;
  license: string;
  /** The file's Commons page — the attribution link the licence asks for. */
  sourceUrl: string;
};

const commons = (file: string) =>
  `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, "_"))}`;

const photo = (
  code: string,
  city: string,
  author: string,
  license: string,
  file: string,
): [string, DestinationPhoto] => [
  code,
  { src: `/destinations/${code}.webp`, city, author, license, sourceUrl: commons(file) },
];

export const DESTINATION_PHOTOS: Record<string, DestinationPhoto> = Object.fromEntries([
  photo("AL", "Tirana", "Chris Walts", "CC BY-SA 2.0", "Skanderbeg square tirana 2016.jpg"),
  photo("AU", "Canberra", "The 3B's", "CC BY 2.0", "Canberra panorama from Mount Ainslie.jpg"),
  photo("AZ", "Baku", "Sefer azeri", "CC BY-SA 4.0", "Panorama of Baku 2022.jpg"),
  photo("CA", "Ottawa", "Arctic.gnome", "CC BY 2.5", "Parliament-Ottawa.jpg"),
  photo("CO", "Bogotá", "Pedro Szekely", "CC BY-SA 2.0", "Bogota, Colombia (36668708290).jpg"),
  photo(
    "CR",
    "San José",
    "Mario Roberto Durán Ortiz",
    "CC BY-SA 4.0",
    "Teatro Nacional CRI 07 2019 8963.jpg",
  ),
  photo("CZ", "Prague", "Moyan Brenn", "CC BY 2.0", "Prague (6365119737).jpg"),
  photo(
    "DE",
    "Berlin",
    "Kasa Fue",
    "CC BY-SA 4.0",
    "Museumsinsel Berlin Juli 2021 1 (cropped) b.jpg",
  ),
  photo(
    "ES",
    "Madrid",
    "Zarateman",
    "CC0",
    "Madrid - Sky Bar 360º (Hotel Riu Plaza España), vistas 19.jpg",
  ),
  photo(
    "FR",
    "Paris",
    "Yann Caradec",
    "CC BY-SA 2.0",
    "La Tour Eiffel vue de la Tour Saint-Jacques, Paris août 2014 (2).jpg",
  ),
  photo("GB", "London", "Ilya Grigorik", "CC BY-SA 3.0", "London Skyline (125508655).jpeg"),
  photo(
    "GE",
    "Tbilisi",
    "Alexey Komarov",
    "CC BY-SA 4.0",
    "View of Tbilisi from Tabori Church 2023-10-08-2.jpg",
  ),
  photo("GR", "Athens", "Andrew Parlette", "CC BY 4.0", "Athens Acropolis at Daybreak.jpg"),
  photo("HR", "Zagreb", "Nick Savchenko", "CC BY-SA 2.0", "Zagreb (29255640143).jpg"),
  photo(
    "HU",
    "Budapest",
    "Visions of Domino",
    "CC BY 2.0",
    "View from Gellért Hill to the Danube, Hungary - Budapest (28493220635).jpg",
  ),
  photo(
    "IL",
    "Jerusalem",
    "Pudelek",
    "CC BY-SA 4.0",
    "Old City Walls and Tower of David in Jerusalem (2019) 01.jpg",
  ),
  photo(
    "IN",
    "New Delhi",
    "Ronakshah1990",
    "CC BY-SA 4.0",
    "Forecourt, Rashtrapati Bhavan - 1.jpg",
  ),
  photo("IT", "Rome", "Diliff", "CC BY 3.0", "Trevi Fountain, Rome, Italy 2 - May 2007.jpg"),
  photo(
    "MX",
    "Mexico City",
    "Gobierno CDMX",
    "CC0",
    "Sobrevuelos CDMX HJ2A4913 (25514321687) (cropped).jpg",
  ),
  photo(
    "NL",
    "Amsterdam",
    "Andrés Barrios",
    "CC BY-SA 4.0",
    "Imagen de los canales concéntricos en Ámsterdam.png",
  ),
  photo(
    "PL",
    "Warsaw",
    "Emptywords",
    "CC BY-SA 4.0",
    "Aleja Niepdleglosci Warsaw 2022 aerial (cropped).jpg",
  ),
  photo("PT", "Lisbon", "Vitor Oliveira", "CC BY-SA 2.0", "Lisboa - Portugal (52597836992).jpg"),
  photo("RO", "Bucharest", "Madalin Pentelie", "CC0", "Bucharest University Square (cropped).jpg"),
  photo("RS", "Belgrade", "Zlatan Jovanovic", "CC BY 3.0", "Panorama Belgrad.jpg"),
  photo("TH", "Bangkok", "Ninara", "CC BY 2.0", "4Y1A1150 Bangkok (33536339665).jpg"),
  photo(
    "TR",
    "Ankara",
    "Diego Delso",
    "CC BY-SA 4.0",
    "Castillo de Ankara, Ankara, Turquía, 2024-10-03, DD 47.jpg",
  ),
  photo(
    "US",
    "Washington, D.C.",
    "Ralf Roletschek",
    "CC BY-SA 3.0",
    "12-07-13-washington-by-RalfR-08.jpg",
  ),
]);
