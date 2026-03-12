export const APP_DISPLAY_VERSION = '1.3.0'

export const CHANGELOG = [
  {
    version: '1.3.0',
    date: '2026-03-10',
    changes: [
      'Fonction "Mot de passe oublié" sur l\'écran de connexion',
      'Réinitialisation du mot de passe par email',
      'Graphique combiné Activité & Conversions avec taux de conversion par action',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-03-10',
    changes: [
      'Boutons "Convertir en client" et "Modifier" accessibles à tous les utilisateurs (commerciaux, direction, autre)',
      'Bouton "Supprimer" et "Reclasser" réservés à la direction',
      'Règles de complexité du mot de passe (8 car., majuscule, minuscule, chiffre, spécial)',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-03-10',
    changes: [
      'Changement de mot de passe obligatoire au premier login',
      'Bouton "Reclasser" (direction) sans impact sur les stats de conversion',
      'Graphiques de taux de conversion mensuel et annuel',
      'Bouton "Nouveau client" sur la page Clients',
      'Bouton "À relancer" visible hors des filtres',
      'Rôle utilisateur "Autre" disponible',
      'Double logo GERMA ETTI + AI',
      'Changelog accessible depuis la page d\'accueil et la sidebar',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-03-09',
    changes: [
      'Import des 926 entreprises et 875 actions du fichier prospects 67',
      'Tableau de bord avec indicateurs et graphiques',
      'Gestion des prospects et clients avec fiches détaillées',
      'Ajout d\'actions commerciales',
      'Gestion des utilisateurs',
      'Export CSV, backup/restore JSON',
      'Journal d\'activité',
    ],
  },
]
