// ==============================================================================
// DATOS SEMILLA / NÓMINA BASE DE DEPORTISTAS PARA PRUEBAS
// ==============================================================================
//
// Cobertura completa de modalidades de sorteo:
// 1. N = 1 (Senior Masc -81kg): Campeón Directo sin contendor.
// 2. N = 2 (Sub-15 Fem -48kg): Al Mejor de 3 con colores fijos.
// 3. N = 3 (Junior Masc -73kg): Round Robin de 3 competidores.
// 4. N = 4 (Cadetes Masc -60kg): Round Robin de 4 competidores.
// 5. N = 5 (Sub-15 Masc -53kg): Round Robin de 5 competidores.
// 6. N = 8 (Senior Masc -73kg): Eliminación Simple de 8 competidores con cuartos, semis, final y bronces.
// 7. Doble categoría: Judokas participando en 2 divisiones simultáneas.
//
// ==============================================================================

import { DraftAthletePayload } from '@/app/actions/registrations';

export const BASE_ATHLETES_ROSTER: DraftAthletePayload[] = [
  // ----------------------------------------------------------------------------
  // 1. MODALIDAD N = 1: CAMPEÓN DIRECTO (1 JUDOKA)
  // ----------------------------------------------------------------------------
  {
    name: 'Felipe Torres',
    club_name: 'Judo Club Alto Hospicio',
    rut_dni: '16.543.210-8',
    category: 'Senior Masculino -81kg',
    gender: 'M',
    birth_year: 2001,
    weight: 79.4,
    seed: 1,
  },

  // ----------------------------------------------------------------------------
  // 2. MODALIDAD N = 2: AL MEJOR DE 3 (2 JUDOKAS, COLORES FIJOS)
  // ----------------------------------------------------------------------------
  {
    name: 'Valentina Rojas',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '21.456.789-0',
    category: 'Sub-15 Femenino -48kg',
    gender: 'F',
    birth_year: 2012,
    weight: 47.1,
    seed: 1,
  },
  {
    name: 'Sofía Valenzuela',
    club_name: 'Club Judo Iquique',
    rut_dni: '21.789.012-3',
    category: 'Sub-15 Femenino -48kg',
    gender: 'F',
    birth_year: 2012,
    weight: 46.5,
    seed: 2,
  },

  // ----------------------------------------------------------------------------
  // 3. MODALIDAD N = 3: ROUND ROBIN DE 3 (3 JUDOKAS)
  // ----------------------------------------------------------------------------
  {
    name: 'Lucas Morales',
    club_name: 'Club Judo Iquique',
    rut_dni: '17.654.321-K',
    category: 'Junior Masculino -73kg',
    gender: 'M',
    birth_year: 2005,
    weight: 71.8,
    seed: 1,
  },
  {
    name: 'Tomás Arancibia',
    club_name: 'Club Judo Maho Alto Hospicio',
    rut_dni: '18.432.109-5',
    category: 'Junior Masculino -73kg',
    gender: 'M',
    birth_year: 2006,
    weight: 72.3,
    seed: 2,
  },
  {
    name: 'Benjamín Castro',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '18.765.432-1',
    category: 'Junior Masculino -73kg',
    gender: 'M',
    birth_year: 2005,
    weight: 70.9,
    seed: 3,
  },

  // ----------------------------------------------------------------------------
  // 4. MODALIDAD N = 4: ROUND ROBIN DE 4 (4 JUDOKAS)
  // ----------------------------------------------------------------------------
  {
    name: 'Carlos Muñoz',
    club_name: 'Club Judo Iquique',
    rut_dni: '19.876.543-2',
    category: 'Cadetes (Sub-18) Masculino -60kg',
    gender: 'M',
    birth_year: 2009,
    weight: 58.5,
    seed: 1,
  },
  {
    name: 'Matías Silva',
    club_name: 'Judo Club Alto Hospicio',
    rut_dni: '20.123.456-7',
    category: 'Cadetes (Sub-18) Masculino -60kg',
    gender: 'M',
    birth_year: 2009,
    weight: 59.2,
    seed: 2,
  },
  {
    name: 'Diego Paredes',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '18.987.654-3',
    category: 'Cadetes (Sub-18) Masculino -60kg',
    gender: 'M',
    birth_year: 2008,
    weight: 57.8,
    seed: 3,
  },
  {
    name: 'Andrés Soto',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '19.345.678-9',
    category: 'Cadetes (Sub-18) Masculino -60kg',
    gender: 'M',
    birth_year: 2009,
    weight: 59.9,
    seed: 4,
  },

  // ----------------------------------------------------------------------------
  // 5. MODALIDAD N = 5: ROUND ROBIN DE 5 (5 JUDOKAS)
  // ----------------------------------------------------------------------------
  {
    name: 'Ignacio Vega',
    club_name: 'Club Judo Iquique',
    rut_dni: '22.345.678-4',
    category: 'Sub-15 Masculino -53kg',
    gender: 'M',
    birth_year: 2012,
    weight: 51.5,
    seed: 1,
  },
  {
    name: 'Cristian Díaz',
    club_name: 'Judo Club Alto Hospicio',
    rut_dni: '22.456.789-2',
    category: 'Sub-15 Masculino -53kg',
    gender: 'M',
    birth_year: 2012,
    weight: 52.1,
    seed: 2,
  },
  {
    name: 'Martín Alarcón',
    club_name: 'Club Judo Maho Alto Hospicio',
    rut_dni: '22.567.890-6',
    category: 'Sub-15 Masculino -53kg',
    gender: 'M',
    birth_year: 2011,
    weight: 50.8,
    seed: 3,
  },
  {
    name: 'Vicente Núñez',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '22.678.901-0',
    category: 'Sub-15 Masculino -53kg',
    gender: 'M',
    birth_year: 2012,
    weight: 52.8,
    seed: 4,
  },
  {
    name: 'Rodrigo Herrera',
    club_name: 'Club Budokan Tarapacá',
    rut_dni: '22.789.012-5',
    category: 'Sub-15 Masculino -53kg',
    gender: 'M',
    birth_year: 2011,
    weight: 51.9,
    seed: 5,
  },

  // ----------------------------------------------------------------------------
  // 6. MODALIDAD N = 8: ELIMINACIÓN SIMPLE DE 8 COMPETIDORES (CUARTOS/SEMIS/FINAL)
  // ----------------------------------------------------------------------------
  {
    name: 'Joaquín Vera',
    club_name: 'Club Judo Iquique',
    rut_dni: '16.789.123-4',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 2000,
    weight: 72.1,
    seed: 1,
  },
  {
    name: 'Sebastián Cáceres',
    club_name: 'Judo Club Alto Hospicio',
    rut_dni: '17.123.456-8',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 2002,
    weight: 71.5,
    seed: 2,
  },
  {
    name: 'Gabriel Fuentes',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '17.234.567-2',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 2001,
    weight: 72.8,
    seed: 3,
  },
  {
    name: 'Álvaro Miranda',
    club_name: 'Club Judo Maho Alto Hospicio',
    rut_dni: '17.345.678-7',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 1999,
    weight: 71.9,
    seed: 4,
  },
  {
    name: 'Nicolás Riquelme',
    club_name: 'Club Budokan Tarapacá',
    rut_dni: '17.456.789-1',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 2003,
    weight: 72.6,
    seed: 5,
  },
  {
    name: 'Esteban Zamorano',
    club_name: 'Club Judo Iquique',
    rut_dni: '17.567.890-5',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 2002,
    weight: 70.8,
    seed: 6,
  },
  {
    name: 'Javier Peña',
    club_name: 'Judo Club Alto Hospicio',
    rut_dni: '17.678.901-9',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 2000,
    weight: 72.4,
    seed: 7,
  },
  {
    name: 'Fernando Osorio',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '17.789.012-3',
    category: 'Senior Masculino -73kg',
    gender: 'M',
    birth_year: 1998,
    weight: 72.9,
    seed: 8,
  },

  // ----------------------------------------------------------------------------
  // 7. JUDOKAS CON DOBLE CATEGORÍA (INSCRIPCIÓN ADICIONAL)
  // ----------------------------------------------------------------------------
  {
    name: 'Valentina Rojas',
    club_name: 'Club de Judo Hiroshima',
    rut_dni: '21.456.789-0',
    category: 'Cadetes (Sub-18) Femenino -48kg',
    gender: 'F',
    birth_year: 2012,
    weight: 47.1,
  },
  {
    name: 'Carlos Muñoz',
    club_name: 'Club Judo Iquique',
    rut_dni: '19.876.543-2',
    category: 'Junior Masculino -60kg',
    gender: 'M',
    birth_year: 2009,
    weight: 58.5,
  },
];
