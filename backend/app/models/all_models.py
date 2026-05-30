"""
Modèles SQLAlchemy pour GrowManager
Contient les 24 tables du schéma complet
"""
from datetime import date, datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, Text, Enum, ForeignKey, DECIMAL, JSON
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import relationship
from app.database import Base


# ============ Tables de référence ============

class Marque(Base):
    __tablename__ = "Marque"

    id_marque = Column(Integer, primary_key=True, autoincrement=True)
    nom_marque = Column(String(50))
    siteweb_marque = Column(String(100))
    contact_marque = Column(String(100))

    # Relations
    boxes = relationship("Box", back_populates="marque")
    lampes = relationship("Lampe", back_populates="marque")
    pots = relationship("Pot", back_populates="marque")
    irrigations = relationship("Irrigation", back_populates="marque")
    ventilations = relationship("Ventilation", back_populates="marque")
    bocals = relationship("Bocal", back_populates="marque")
    press = relationship("Press", back_populates="marque")
    rosin_bags = relationship("RosinBag", back_populates="marque")
    ice_o_bags = relationship("IceOBag", back_populates="marque")
    engrais = relationship("Engrais", back_populates="marque")


class Fournisseur(Base):
    __tablename__ = "Fournisseur"

    id_fournisseur = Column(Integer, primary_key=True, autoincrement=True)
    nom_fournisseur = Column(String(255), nullable=False)
    site_web = Column(String(255))

    # Relations
    pack_graines = relationship("PackGraine", back_populates="fournisseur")
    boxes = relationship("Box", back_populates="fournisseur")
    lampes = relationship("Lampe", back_populates="fournisseur")
    pots = relationship("Pot", back_populates="fournisseur")
    irrigations = relationship("Irrigation", back_populates="fournisseur")
    ventilations = relationship("Ventilation", back_populates="fournisseur")
    bocals = relationship("Bocal", back_populates="fournisseur")
    press = relationship("Press", back_populates="fournisseur")
    rosin_bags = relationship("RosinBag", back_populates="fournisseur")
    ice_o_bags = relationship("IceOBag", back_populates="fournisseur")
    engrais = relationship("Engrais", back_populates="fournisseur")


class Breeder(Base):
    __tablename__ = "Breeder"

    id_breeder = Column(Integer, primary_key=True, autoincrement=True)
    nom_breeder = Column(String(255), nullable=False)
    origine_breeder = Column(String(255))
    information_breeder = Column(String(255))

    # Relations
    graines = relationship("Graine", back_populates="breeder")


class Variete(Base):
    __tablename__ = "Variete"

    id_variete = Column(Integer, primary_key=True, autoincrement=True)
    nom_variete = Column(String(255), nullable=False)
    croisement_variete = Column(String(255))
    informations_variete = Column(String(255))
    lien_web = Column(String(500))

    # Relations
    graines = relationship("Graine", back_populates="variete")
    stocks = relationship("Stock", back_populates="variete")
    hash_extractions = relationship("HashExtraction", back_populates="variete")


# ============ Tables de graines ============

class PackGraine(Base):
    __tablename__ = "PackGraine"

    id_packgraine = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    nbr_graines = Column(Integer)
    prix_achat = Column(DECIMAL(10, 2))
    date_achat = Column(Date)
    duree_conservation_mois = Column(Integer)  # durée de conservation en mois

    # Relations
    fournisseur = relationship("Fournisseur", back_populates="pack_graines")
    graines = relationship("Graine", back_populates="pack_graine")


class Graine(Base):
    __tablename__ = "Graine"

    id_graine = Column(Integer, primary_key=True, autoincrement=True)
    id_breeder = Column(Integer, ForeignKey("Breeder.id_breeder"))
    id_variete = Column(Integer, ForeignKey("Variete.id_variete"))
    id_packgraine = Column(Integer, ForeignKey("PackGraine.id_packgraine"))
    duree_flo_min = Column(Integer)
    duree_flo_max = Column(Integer)
    types_graines = Column(String(50))
    prix_achat = Column(DECIMAL(10, 2))
    edition_limite = Column(Boolean, default=False)
    date_achat = Column(Date)
    utilisee = Column(Boolean, default=False)

    # Relations
    breeder = relationship("Breeder", back_populates="graines")
    variete = relationship("Variete", back_populates="graines")
    pack_graine = relationship("PackGraine", back_populates="graines")
    cultures = relationship(
        "Culture",
        secondary="CultureGraine",
        back_populates="graines",
    )
    plants = relationship("Plant", back_populates="graine")
    recoltes = relationship(
        "Recolte",
        secondary="RecolteGraine",
        back_populates="graines",
    )


# ============ Tables de matériel ============

class Box(Base):
    __tablename__ = "Box"

    id_box = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    largeur_tente = Column(Integer)
    profondeur_tente = Column(Integer)
    hauteur_tente = Column(Integer)
    nbr_etage = Column(Integer)
    date_achat = Column(Date)
    prix = Column(DECIMAL(10, 2))
    etat = Column(String(50))
    nbr_culture = Column(Integer, default=0)

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="boxes")
    cultures = relationship("Culture", back_populates="box")


class Lampe(Base):
    __tablename__ = "Lampe"

    id_lampe = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    largeur_lampe = Column(Integer)
    profondeur_lampe = Column(Integer)
    hauteur_lampe = Column(Integer)
    puissance_lampe = Column(Integer)
    date_achat = Column(Date)
    prix = Column(DECIMAL(10, 2))
    etat = Column(String(50))
    nbr_culture = Column(Integer, default=0)

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="lampes")
    cultures = relationship(
        "Culture",
        secondary="CultureLampe",
        back_populates="lampes",
    )


class Pot(Base):
    __tablename__ = "Pot"

    id_pot = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    taille_pot = Column(Integer)
    dimension_pot = Column(String(50))
    date_achat = Column(Date)
    prix = Column(DECIMAL(10, 2))
    etat = Column(String(50))
    nbr_culture = Column(Integer, default=0)

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="pots")
    cultures = relationship(
        "Culture",
        secondary="CulturePot",
        back_populates="pots",
    )


class Irrigation(Base):
    __tablename__ = "Irrigation"

    id_irrigation = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    type_irrigation = Column(String(50))
    debit_irrigation = Column(Integer)
    diametre_irrigation = Column(Integer)
    date_achat = Column(Date)
    prix = Column(DECIMAL(10, 2))
    nbr_culture = Column(Integer, default=0)

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="irrigations")
    cultures = relationship(
        "Culture",
        secondary="CultureIrrigation",
        back_populates="irrigations",
    )


class Ventilation(Base):
    __tablename__ = "Ventilation"

    id_ventilation = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    type_ventilation = Column(String(50))
    debit_ventilation = Column(Integer)
    diametre_ventilation = Column(Integer)
    longueur_ventilation = Column(Integer)
    date_achat = Column(Date)
    prix = Column(DECIMAL(10, 2))
    etat = Column(String(50))
    nbr_culture = Column(Integer, default=0)

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="ventilations")
    cultures = relationship(
        "Culture",
        secondary="CultureVentilation",
        back_populates="ventilations",
    )


class Bocal(Base):
    __tablename__ = "Bocal"

    id_bocal = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    taille_bocal = Column(Integer)
    date_achat = Column(Date)
    prix = Column(DECIMAL(10, 2))

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="bocals")
    stocks = relationship("Stock", back_populates="bocal")
    rosin_extractions = relationship("RosinExtraction", back_populates="bocal")


class Press(Base):
    __tablename__ = "Press"

    id_press = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    largeur_plate = Column(DECIMAL(10, 1))
    profondeur_plate = Column(DECIMAL(10, 1))
    pression_press = Column(Integer)
    date_achat = Column(Date)
    prix = Column(DECIMAL(10, 2))

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="press")
    rosin_extractions = relationship("RosinExtraction", back_populates="press")


class RosinBag(Base):
    __tablename__ = "RosinBag"

    id_rosinbag = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    dimensions_rosinbag = Column(String(50))
    maillage = Column(String(50))
    nombre_rosinbag = Column(String(50))
    date_achat_rosinbag = Column(Date)
    prix_rosinbag = Column(DECIMAL(10, 2))
    info_rosinbag = Column(String(100))

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="rosin_bags")
    rosin_extractions = relationship("RosinExtraction", back_populates="rosin_bag")


class IceOBag(Base):
    __tablename__ = "IceOBag"

    id_iceobag = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    maillage_iceobag = Column(String(50))
    date_achat_iceobag = Column(Date)
    prix_iceobag = Column(DECIMAL(10, 2))
    info_iceobag = Column(String(100))

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="ice_o_bags")
    hash_extractions = relationship("HashExtraction", back_populates="ice_o_bag")


class Engrais(Base):
    __tablename__ = "Engrais"

    id_engrais = Column(Integer, primary_key=True, autoincrement=True)
    id_fournisseur = Column(Integer, ForeignKey("Fournisseur.id_fournisseur"))
    id_marque = Column(Integer, ForeignKey("Marque.id_marque"))
    nom_engrais = Column(String(255))
    quantite_bouteille = Column(DECIMAL(10, 2))
    quantite_restante = Column(DECIMAL(10, 2))
    unite_mesure = Column(String(10))
    prix_achat = Column(DECIMAL(10, 2))
    date_achat = Column(Date)
    date_peremption = Column(Date)
    information_complementaire = Column(String(255))

    # Relations
    fournisseur = relationship("Fournisseur")
    marque = relationship("Marque", back_populates="engrais")
    cultures = relationship(
        "Culture",
        secondary="CultureEngrais",
        back_populates="engrais",
    )


# ============ Tables de culture ============

class Culture(Base):
    __tablename__ = "Culture"

    id_culture = Column(Integer, primary_key=True, autoincrement=True)
    id_box = Column(Integer, ForeignKey("Box.id_box"))
    id_espace = Column(Integer, ForeignKey("EspaceCulture.id_espace"), nullable=True)
    nom = Column(String(200), nullable=True)                          # ex: "OG Kush Batch #3"
    date_debut = Column(Date, nullable=True)                          # date de démarrage de la culture
    statut = Column(String(50), nullable=True, default="active")      # active | sechage_curing | terminee
    date_fin = Column(Date, nullable=True)                            # date de clôture (auto ou manuelle)
    date_recolte_estimee = Column(Date, nullable=True)                # calculée depuis date_passage_12_12 + duree_flo
    type_culture = Column(String(50))                                   # indoor | outdoor | greenhouse
    type_eclairage = Column(String(50))                                 # LED | HPS | CMH | LEC | fluorescent | soleil
    but_culture = Column(String(100))                                   # Récolte | Hunt | Reproduction | (paramétrable)
    date_germination = Column(Date)
    date_debut_croissance = Column(Date)
    date_passage_12_12 = Column(Date)
    date_debut_floraison = Column(Date)
    duree_croissance = Column(Integer)
    duree_stretch = Column(Integer)
    phase = Column(String(50))
    notes = Column(Text)

    # Relations
    box = relationship("Box", back_populates="cultures")
    espace = relationship("EspaceCulture", foreign_keys=[id_espace])
    graines = relationship(
        "Graine",
        secondary="CultureGraine",
        back_populates="cultures",
    )
    engrais = relationship(
        "Engrais",
        secondary="CultureEngrais",
        back_populates="cultures",
    )
    lampes = relationship(
        "Lampe",
        secondary="CultureLampe",
        back_populates="cultures",
    )
    pots = relationship(
        "Pot",
        secondary="CulturePot",
        back_populates="cultures",
    )
    irrigations = relationship(
        "Irrigation",
        secondary="CultureIrrigation",
        back_populates="cultures",
    )
    ventilations = relationship(
        "Ventilation",
        secondary="CultureVentilation",
        back_populates="cultures",
    )
    plants = relationship("Plant", back_populates="culture")
    actions = relationship("ActionCalendrier", back_populates="culture")
    recoltes = relationship(
        "Recolte",
        secondary="RecolteCulture",
        back_populates="cultures",
    )


# Tables d'association
class CultureGraine(Base):
    __tablename__ = "CultureGraine"

    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), primary_key=True)
    id_graine = Column(Integer, ForeignKey("Graine.id_graine", ondelete="CASCADE"), primary_key=True)


class CultureEngrais(Base):
    __tablename__ = "CultureEngrais"

    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), primary_key=True)
    id_engrais = Column(Integer, ForeignKey("Engrais.id_engrais", ondelete="CASCADE"), primary_key=True)


class CultureLampe(Base):
    __tablename__ = "CultureLampe"

    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), primary_key=True)
    id_lampe = Column(Integer, ForeignKey("Lampe.id_lampe", ondelete="CASCADE"), primary_key=True)


class CulturePot(Base):
    __tablename__ = "CulturePot"

    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), primary_key=True)
    id_pot = Column(Integer, ForeignKey("Pot.id_pot", ondelete="CASCADE"), primary_key=True)


class CultureIrrigation(Base):
    __tablename__ = "CultureIrrigation"

    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), primary_key=True)
    id_irrigation = Column(Integer, ForeignKey("Irrigation.id_irrigation", ondelete="CASCADE"), primary_key=True)


class CultureVentilation(Base):
    __tablename__ = "CultureVentilation"

    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), primary_key=True)
    id_ventilation = Column(Integer, ForeignKey("Ventilation.id_ventilation", ondelete="CASCADE"), primary_key=True)


# ============ Table Plant et ActionCalendrier ============

class Plant(Base):
    __tablename__ = "Plant"

    id_plant = Column(Integer, primary_key=True, autoincrement=True)
    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), nullable=False)
    id_graine = Column(Integer, ForeignKey("Graine.id_graine"))
    nom_affichage = Column(String(100), nullable=False)
    numero_plant = Column(Integer)
    origine = Column(Enum('graine', 'bouture', 'clone'), default='graine')
    statut = Column(String(50), default='germination')  # germination | veg | floraison | sechage | curing | prete | recolte | abandonne
    date_germination = Column(Date)
    date_debut_flo = Column(Date)
    date_recolte = Column(Date)
    date_fin_sechage = Column(Date)
    poids_recolte_g = Column(DECIMAL(10, 2))
    substrat = Column(String(100))                                      # terre | coco | hydro | sol_vivant | autre
    id_recette_sol = Column(Integer, ForeignKey("RecetteLSO.id_recette_lso"), nullable=True)
    id_pot = Column(Integer, nullable=True)                             # id_materiel du pot (table Materiel, catégorie Pots)
    volume_pot_l = Column(DECIMAL(6, 2), nullable=True)                 # volume du pot en litres (si pas de pot inventaire)
    notes = Column(Text)
    # Clonage
    id_plant_mere = Column(Integer, ForeignKey("Plant.id_plant", ondelete="SET NULL"), nullable=True)
    date_prelevement = Column(Date, nullable=True)                      # date de prise de bouture
    date_enracinement = Column(Date, nullable=True)                     # date d'enracinement constatée
    statut_clone = Column(String(20), nullable=True)                    # en_attente | enracine | rate

    # Relations
    culture = relationship("Culture", back_populates="plants")
    graine = relationship("Graine", back_populates="plants")
    actions = relationship("ActionCalendrier", back_populates="plant")
    recette_sol = relationship("RecetteLSO", foreign_keys=[id_recette_sol])
    plant_mere = relationship("Plant", remote_side="Plant.id_plant", foreign_keys="Plant.id_plant_mere", backref="clones")


class ActionCalendrier(Base):
    __tablename__ = "ActionCalendrier"

    id_action = Column(Integer, primary_key=True, autoincrement=True)
    id_plant = Column(Integer, ForeignKey("Plant.id_plant", ondelete="CASCADE"), nullable=True)
    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), nullable=False)
    date_action = Column(Date, nullable=False)
    type_action = Column(String(100), nullable=False)      # string libre (graine_verre_eau, mise_sous_led, arrosage_engrais…)
    parametres = Column(JSON, nullable=True)               # params spécifiques au type (volume, produits, %)
    note = Column(Text)
    global_culture = Column(Boolean, default=False)        # True = action sur tout l'espace, False = plante spécifique
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relations
    plant = relationship("Plant", back_populates="actions")
    culture = relationship("Culture", back_populates="actions")


# ============ Suivi température / hygrométrie — Govee H5179 ============

class GoveeDevice(Base):
    """Capteur Govee enregistré dans l'application."""
    __tablename__ = "GoveeDevice"

    id_device    = Column(Integer,  primary_key=True, autoincrement=True)
    nom          = Column(String(200), nullable=False)          # ex: "Box Floraison 1"
    device_id    = Column(String(100), nullable=True)           # MAC ou device ID Govee
    modele       = Column(String(50),  nullable=True)           # ex: H5179
    ip_lan       = Column(String(50),  nullable=True)           # IP locale (LAN API)
    id_espace    = Column(Integer, ForeignKey("EspaceCulture.id_espace"), nullable=True)
    actif        = Column(Boolean, default=True)
    notes        = Column(Text, nullable=True)

    espace = relationship("EspaceCulture")
    logs   = relationship("TemperatureLog", back_populates="device",
                          cascade="all, delete-orphan")


class TemperatureLog(Base):
    __tablename__ = "TemperatureLog"

    id_log       = Column(Integer,  primary_key=True, autoincrement=True)
    id_device    = Column(Integer,  ForeignKey("GoveeDevice.id_device", ondelete="CASCADE"), nullable=True)
    id_culture   = Column(Integer,  ForeignKey("Culture.id_culture",  ondelete="CASCADE"), nullable=True)
    id_espace    = Column(Integer,  ForeignKey("EspaceCulture.id_espace"), nullable=True)
    date_heure   = Column(DateTime, nullable=False, default=datetime.utcnow)
    temperature  = Column(Float,    nullable=True)   # °C
    humidite     = Column(Float,    nullable=True)   # %RH
    vpd          = Column(Float,    nullable=True)   # kPa (calculé)
    source       = Column(String(50), nullable=True, default="govee")  # govee | manual

    culture = relationship("Culture")
    device  = relationship("GoveeDevice", back_populates="logs")


# ============ Tables de récolte ============

class Recolte(Base):
    __tablename__ = "Recolte"

    id_recolte = Column(Integer, primary_key=True, autoincrement=True)
    id_culture = Column(Integer, ForeignKey("Culture.id_culture"))
    date_recolte = Column(Date)
    quantite = Column(DECIMAL(10, 2))

    # Relations
    cultures = relationship(
        "Culture",
        secondary="RecolteCulture",
        back_populates="recoltes",
    )
    graines = relationship(
        "Graine",
        secondary="RecolteGraine",
        back_populates="recoltes",
    )


class RecolteCulture(Base):
    __tablename__ = "RecolteCulture"

    id_recolte = Column(Integer, ForeignKey("Recolte.id_recolte", ondelete="CASCADE"), primary_key=True)
    id_culture = Column(Integer, ForeignKey("Culture.id_culture", ondelete="CASCADE"), primary_key=True)


class RecolteGraine(Base):
    __tablename__ = "RecolteGraine"

    id_recolte = Column(Integer, ForeignKey("Recolte.id_recolte", ondelete="CASCADE"), primary_key=True)
    id_graine = Column(Integer, ForeignKey("Graine.id_graine", ondelete="CASCADE"), primary_key=True)


# ============ Tables de stock ============

class Stock(Base):
    __tablename__ = "Stock"

    id_stock = Column(Integer, primary_key=True, autoincrement=True)
    id_variete = Column(Integer, ForeignKey("Variete.id_variete"))
    id_bocal = Column(Integer, ForeignKey("Bocal.id_bocal"))
    id_materiel_bocal = Column(Integer, ForeignKey("Materiel.id_materiel"), nullable=True)
    id_plant = Column(Integer, ForeignKey("Plant.id_plant"), nullable=True)   # V4-F traçabilité
    type_stock = Column(String(50))
    sous_type_stock = Column(String(50))
    lampe_type = Column(String(50))
    engrais_type = Column(String(200), nullable=True)   # marques des engrais utilisés
    substrat_type = Column(String(200), nullable=True)  # substrat (coco, sol vivant…)
    maillage = Column(String(20), nullable=True)
    type_hash = Column(String(50), nullable=True)
    type_rosin = Column(String(50), nullable=True)
    date_stock = Column(Date)
    date_fin_stock = Column(Date, nullable=True)     # date de clôture (sortie manuelle ou stock=0)
    quantite_stock = Column(DECIMAL(10, 2))
    quantite_initiale = Column(DECIMAL(10, 2), nullable=True)   # quantité à la création (pour calcul % restant)

    # Relations
    variete = relationship("Variete", back_populates="stocks")
    bocal = relationship("Bocal", back_populates="stocks")
    materiel_bocal = relationship("Materiel", foreign_keys=[id_materiel_bocal])
    plant = relationship("Plant", foreign_keys=[id_plant])
    rosin_extractions = relationship("RosinExtraction", back_populates="stock_source")


# ============ Tables d'extractions ============

class RosinExtraction(Base):
    __tablename__ = "RosinExtraction"

    id_rosinextraction = Column(Integer, primary_key=True, autoincrement=True)
    id_bocal = Column(Integer, ForeignKey("Bocal.id_bocal"))
    id_rosinbag = Column(Integer, ForeignKey("RosinBag.id_rosinbag"))
    id_press = Column(Integer, ForeignKey("Press.id_press"))
    id_stock_source = Column(Integer, ForeignKey("Stock.id_stock"))
    nom_variete_extract = Column(String(50))
    date_rosinextraction = Column(Date)
    temperature_extraction = Column(Integer)
    maillage = Column(String(20))       # ex: 72µ, 90µ, 120µ…
    duree_preheat = Column(Integer)     # secondes ou minutes
    duree_extraction = Column(Integer)  # secondes ou minutes
    # Poids par sac d'entrée (g)
    sac_1_poids = Column(DECIMAL(10, 2))
    sac_2_poids = Column(DECIMAL(10, 2))
    sac_3_poids = Column(DECIMAL(10, 2))
    sac_4_poids = Column(DECIMAL(10, 2))
    sources           = Column(JSON, nullable=True)              # [{"id_stock": int, "quantite": float}]
    quantite_utilisee = Column(DECIMAL(10, 2))   # total entrée = somme sources (ou somme sacs)
    # Poids par passe de presse (g)
    presse_1_poids = Column(DECIMAL(10, 2))
    presse_2_poids = Column(DECIMAL(10, 2))
    presse_3_poids = Column(DECIMAL(10, 2))
    presse_4_poids = Column(DECIMAL(10, 2))
    quantite_extraite = Column(DECIMAL(10, 2))   # total sortie = somme passes
    info_rosinextraction = Column(String(255))

    # Relations
    bocal = relationship("Bocal", back_populates="rosin_extractions")
    rosin_bag = relationship("RosinBag", back_populates="rosin_extractions")
    press = relationship("Press", back_populates="rosin_extractions")
    stock_source = relationship("Stock", back_populates="rosin_extractions")


# ============ Historique des cultures ============

class HistoriqueCulture(Base):
    __tablename__ = "HistoriqueCulture"

    id_historique_culture = Column(Integer, primary_key=True, autoincrement=True)
    nom                    = Column(String(200))    # nom libre de la culture
    date_debut             = Column(Date)
    date_fin               = Column(Date)
    tente                  = Column(String(100))   # liste fixe
    lampe                  = Column(String(100))   # liste fixe
    puissance              = Column(Integer)       # watts
    type_culture           = Column(String(50))    # Indoor / Outdoor
    engrais                = Column(String(100))   # liste fixe
    substrat               = Column(String(100))   # liste fixe — nouveau
    id_espace              = Column(Integer, ForeignKey("EspaceCulture.id_espace"), nullable=True)
    notes                  = Column(Text)

    # Coûts calculés à la clôture
    cout_engrais           = Column(DECIMAL(10, 2), nullable=True)   # € dépensés en engrais
    cout_electricite       = Column(DECIMAL(10, 2), nullable=True)   # € d'électricité
    cout_graines           = Column(DECIMAL(10, 2), nullable=True)   # € de graines
    cout_total             = Column(DECIMAL(10, 2), nullable=True)   # somme des 3
    cout_par_gramme        = Column(DECIMAL(10, 4), nullable=True)   # €/g récolté

    # Relation vers les plantes de cette culture
    plants = relationship("HistoriquePlant", back_populates="culture",
                          cascade="all, delete-orphan")


class HistoriquePlant(Base):
    """Une plante dans une culture historique."""
    __tablename__ = "HistoriquePlant"

    id_historique_plant   = Column(Integer, primary_key=True, autoincrement=True)
    id_historique_culture = Column(Integer, ForeignKey("HistoriqueCulture.id_historique_culture", ondelete="CASCADE"), nullable=False)
    id_variete            = Column(Integer, ForeignKey("Variete.id_variete"), nullable=True)
    variete_nom           = Column(String(255))      # dénormalisé pour affichage rapide
    numero_plant          = Column(Integer)          # numéro dans la culture (1, 2, 3…)
    date_debut_plant      = Column(Date)             # date de début propre à la plante
    date_fin_plant        = Column(Date)             # date de fin propre à la plante
    prix_graine           = Column(DECIMAL(10, 2))   # auto-rempli depuis Graine
    quantite_recoltee     = Column(DECIMAL(10, 2))   # g récoltés pour cette plante
    notes                 = Column(Text)

    # Relations
    culture = relationship("HistoriqueCulture", back_populates="plants")
    variete = relationship("Variete")


class Materiel(Base):
    __tablename__ = "Materiel"

    id_materiel       = Column(Integer, primary_key=True, autoincrement=True)
    categorie         = Column(String(50),  nullable=False)
    nom               = Column(String(200), nullable=False)
    marque            = Column(String(100), nullable=True)
    code_barre_serial = Column(String(100), nullable=True)
    date_achat        = Column(Date,        nullable=True)
    prix_achat        = Column(DECIMAL(10, 2), nullable=True)
    site_achat        = Column(String(200), nullable=True)
    etat               = Column(String(50),  nullable=True)   # Neuf / Bon état / Usagé / Hors service
    date_sortie_stock  = Column(Date,        nullable=True)   # renseigné quand Hors service
    notes              = Column(Text,        nullable=True)
    caracteristiques   = Column(JSON,        nullable=True)   # champs spécifiques à la catégorie


class ParametreListeValeur(Base):
    """Valeurs paramétrables des listes déroulantes de l'application."""
    __tablename__ = "ParametreListeValeur"

    id_parametre = Column(Integer, primary_key=True, autoincrement=True)
    liste_nom    = Column(String(100), nullable=False)
    valeur       = Column(String(500), nullable=False)
    ordre        = Column(Integer, default=0)


class HashExtraction(Base):
    __tablename__ = "HashExtraction"

    id_hashextraction   = Column(Integer, primary_key=True, autoincrement=True)
    id_variete          = Column(Integer, ForeignKey("Variete.id_variete"), nullable=True)
    id_iceobag          = Column(Integer, ForeignKey("IceOBag.id_iceobag"), nullable=True)
    id_stock_source     = Column(Integer, ForeignKey("Stock.id_stock"), nullable=True)
    nom_variete_hash    = Column(String(100), nullable=True)
    date_hashextraction = Column(Date)
    type_extraction     = Column(String(20), nullable=True)   # 'Polinator' | 'Ice-o-lator'
    duree_polinator     = Column(Integer, nullable=True)       # minutes, pour Polinator
    maillage_polinator  = Column(String(20), nullable=True)    # maillage sélectionné, pour Polinator
    passages            = Column(JSON, nullable=True)          # [{"duree": int}] pour Ice-o-lator
    sacs                = Column(JSON, nullable=True)          # [{"maillage": str, "poids": float}]
    sources             = Column(JSON, nullable=True)          # [{"id_stock": int, "quantite": float}]
    quantite_utilisee   = Column(DECIMAL(10, 2))
    quantite_extraite   = Column(DECIMAL(10, 2))
    info_hashextraction = Column(Text, nullable=True)

    # Relations
    variete      = relationship("Variete", back_populates="hash_extractions")
    ice_o_bag    = relationship("IceOBag", back_populates="hash_extractions")
    stock_source = relationship("Stock", foreign_keys=[id_stock_source])


# ============ Sols & Engrais ============

class ProduitEngrais(Base):
    __tablename__ = "ProduitEngrais"

    id_produit              = Column(Integer, primary_key=True, autoincrement=True)
    nom_produit             = Column(String(200), nullable=False)
    marque                  = Column(String(100), nullable=True)
    type_produit            = Column(String(50),  nullable=True)   # liquide, solide, poudre…
    conditionnement         = Column(String(50),  nullable=True)   # bouteille, pot, sachet…
    volume_conditionnement  = Column(DECIMAL(10, 3), nullable=True) # taille du contenant
    unite_volume            = Column(String(10),  nullable=True)   # mL, L, g, Kg
    prix_achat              = Column(DECIMAL(10, 2), nullable=True)
    date_achat              = Column(Date, nullable=True)
    date_peremption         = Column(Date, nullable=True)
    quantite_stock          = Column(DECIMAL(10, 3), nullable=True) # quantité restante
    unite_quantite          = Column(String(10),  nullable=True)   # g, mL
    dosage_conseille        = Column(String(500), nullable=True)
    notes                   = Column(Text, nullable=True)

    achats = relationship("AchatEngrais", back_populates="produit", order_by="AchatEngrais.date_achat.desc()")


class AchatEngrais(Base):
    """Historique des achats / recharges d'un produit engrais."""
    __tablename__ = "AchatEngrais"

    id_achat               = Column(Integer, primary_key=True, autoincrement=True)
    id_produit             = Column(Integer, ForeignKey("ProduitEngrais.id_produit"), nullable=False)
    date_achat             = Column(Date,          nullable=True)
    volume_achat           = Column(DECIMAL(10, 3), nullable=True)   # volume du contenant acheté
    unite_volume           = Column(String(10),    nullable=True)    # mL, L, g, Kg
    prix_achat             = Column(DECIMAL(10, 2), nullable=True)
    date_peremption        = Column(Date,          nullable=True)
    conditionnement        = Column(String(50),    nullable=True)    # Bouteille, Pot…
    notes                  = Column(String(500),   nullable=True)
    created_at             = Column(DateTime,      default=datetime.utcnow)

    produit = relationship("ProduitEngrais", back_populates="achats")


# ============ Recettes ============

class RecetteEngrais(Base):
    __tablename__ = "RecetteEngrais"

    id_recette   = Column(Integer,     primary_key=True, autoincrement=True)
    nom_recette  = Column(String(200), nullable=False)
    type_recette = Column(String(50),  nullable=True)   # Arrosage | Pulvérisation
    periode      = Column(String(50),  nullable=True)   # Veg, Flo, Early Flo…
    semaine      = Column(Integer,     nullable=True)   # 1-20
    ph_cible     = Column(Float,       nullable=True)
    notes        = Column(Text,        nullable=True)

    lignes = relationship(
        "RecetteEngraisLigne",
        back_populates="recette",
        cascade="all, delete-orphan",
        order_by="RecetteEngraisLigne.ordre",
    )


class RecetteEngraisLigne(Base):
    __tablename__ = "RecetteEngraisLigne"

    id_ligne   = Column(Integer, primary_key=True, autoincrement=True)
    id_recette = Column(Integer, ForeignKey("RecetteEngrais.id_recette"), nullable=False)
    id_produit = Column(Integer, ForeignKey("ProduitEngrais.id_produit"), nullable=False)
    dosage     = Column(Float,      nullable=False, default=0.0)
    unite      = Column(String(10), nullable=True)   # mL/L | g/L
    ordre      = Column(Integer,    default=0)

    recette = relationship("RecetteEngrais", back_populates="lignes")
    produit = relationship("ProduitEngrais")


class RecetteTCO(Base):
    __tablename__ = "RecetteTCO"

    id_recette_tco      = Column(Integer,     primary_key=True, autoincrement=True)
    nom_recette         = Column(String(200), nullable=False)
    type_tco            = Column(String(50),  nullable=True)   # Croissance | Stretch | Floraison | Correctif
    quantite_tco        = Column(Float,       nullable=True)   # volume total préparé (en litres)
    unite_tco           = Column(String(10),  nullable=True)   # L | mL
    duree_oxygenation_h = Column(Integer,     nullable=True)   # heures d'oxygénation avant utilisation
    notes               = Column(Text,        nullable=True)

    lignes = relationship(
        "RecetteTCOLigne",
        back_populates="recette",
        cascade="all, delete-orphan",
        order_by="RecetteTCOLigne.ordre",
    )


class RecetteTCOLigne(Base):
    __tablename__ = "RecetteTCOLigne"

    id_ligne       = Column(Integer, primary_key=True, autoincrement=True)
    id_recette_tco = Column(Integer, ForeignKey("RecetteTCO.id_recette_tco"), nullable=False)
    id_produit     = Column(Integer, ForeignKey("ProduitEngrais.id_produit"), nullable=False)
    quantite       = Column(Float,      nullable=False, default=0.0)
    unite          = Column(String(10), nullable=True)   # mL | L | g | Kg
    note_ligne     = Column(String(500), nullable=True)  # ex: "ajouter après 30 min de brassage"
    ordre          = Column(Integer,    default=0)

    recette = relationship("RecetteTCO", back_populates="lignes")
    produit = relationship("ProduitEngrais")


# ============ Recette Sol Vivant (LSO) ============

class RecetteLSO(Base):
    __tablename__ = "RecetteLSO"

    id_recette_lso  = Column(Integer,     primary_key=True, autoincrement=True)
    nom_recette     = Column(String(200), nullable=False)
    type_lso        = Column(String(50),  nullable=True)
    quantite_totale = Column(Float,       nullable=True)   # volume total de sol préparé
    unite_quantite  = Column(String(10),  nullable=True)   # L | Kg
    notes           = Column(Text,        nullable=True)

    lignes = relationship(
        "RecetteLSOLigne",
        back_populates="recette",
        cascade="all, delete-orphan",
        order_by="RecetteLSOLigne.ordre",
    )


class RecetteLSOLigne(Base):
    __tablename__ = "RecetteLSOLigne"

    id_ligne       = Column(Integer, primary_key=True, autoincrement=True)
    id_recette_lso = Column(Integer, ForeignKey("RecetteLSO.id_recette_lso"), nullable=False)
    id_produit     = Column(Integer, ForeignKey("ProduitEngrais.id_produit"), nullable=False)
    quantite       = Column(Float,       nullable=False, default=0.0)
    unite          = Column(String(10),  nullable=True)   # mL | L | g | Kg
    note_ligne     = Column(String(500), nullable=True)
    ordre          = Column(Integer,     default=0)

    recette = relationship("RecetteLSO", back_populates="lignes")
    produit = relationship("ProduitEngrais")


# ============ Recette Réamendement ============

class RecetteReamendement(Base):
    __tablename__ = "RecetteReamendement"

    id_recette_reamend = Column(Integer,     primary_key=True, autoincrement=True)
    nom_recette        = Column(String(200), nullable=False)
    volume_pot         = Column(Float,       nullable=True)   # volume du pot en L
    unite_pot          = Column(String(10),  nullable=True, default="L")
    notes              = Column(Text,        nullable=True)

    lignes = relationship(
        "RecetteReamendementLigne",
        back_populates="recette",
        cascade="all, delete-orphan",
        order_by="RecetteReamendementLigne.ordre",
    )


class RecetteReamendementLigne(Base):
    __tablename__ = "RecetteReamendementLigne"

    id_ligne           = Column(Integer, primary_key=True, autoincrement=True)
    id_recette_reamend = Column(Integer, ForeignKey("RecetteReamendement.id_recette_reamend"), nullable=False)
    id_produit         = Column(Integer, ForeignKey("ProduitEngrais.id_produit"), nullable=False)
    quantite           = Column(Float,       nullable=False, default=0.0)
    unite              = Column(String(10),  nullable=True)   # g | Kg | mL | L
    note_ligne         = Column(String(500), nullable=True)
    ordre              = Column(Integer,     default=0)

    recette = relationship("RecetteReamendement", back_populates="lignes")
    produit = relationship("ProduitEngrais")


# ============ Recette Arrosage ============

class RecetteArrosage(Base):
    __tablename__ = "RecetteArrosage"

    id_recette_arrosage = Column(Integer,     primary_key=True, autoincrement=True)
    nom_recette         = Column(String(200), nullable=False)
    type_arrosage       = Column(String(50),  nullable=True)   # Eau simple | Eau + amendements
    quantite_eau        = Column(Float,       nullable=True)   # volume d'eau de base
    unite_eau           = Column(String(10),  nullable=True)   # L | mL
    notes               = Column(Text,        nullable=True)

    lignes = relationship(
        "RecetteArrosageLigne",
        back_populates="recette",
        cascade="all, delete-orphan",
        order_by="RecetteArrosageLigne.ordre",
    )


class RecetteArrosageLigne(Base):
    __tablename__ = "RecetteArrosageLigne"

    id_ligne            = Column(Integer, primary_key=True, autoincrement=True)
    id_recette_arrosage = Column(Integer, ForeignKey("RecetteArrosage.id_recette_arrosage"), nullable=False)
    id_produit          = Column(Integer, ForeignKey("ProduitEngrais.id_produit"), nullable=False)
    quantite            = Column(Float,      nullable=False, default=0.0)
    unite               = Column(String(10), nullable=True)   # mL | L | g | Kg
    note_ligne          = Column(String(500), nullable=True)
    ordre               = Column(Integer,    default=0)

    recette = relationship("RecetteArrosage", back_populates="lignes")
    produit = relationship("ProduitEngrais")


# ============ Recette Fermentation ============

class RecetteFermentation(Base):
    __tablename__ = "RecetteFermentation"

    id_recette_ferm  = Column(Integer,     primary_key=True, autoincrement=True)
    nom_recette      = Column(String(200), nullable=False)
    type_fermentation = Column(String(50), nullable=True)   # paramétrable
    volume_total     = Column(Float,       nullable=True)   # volume total préparé
    unite_volume     = Column(String(10),  nullable=True)   # L | mL
    duree_fermentation = Column(Integer,   nullable=True)   # heures
    notes            = Column(Text,        nullable=True)

    lignes = relationship(
        "RecetteFermentationLigne",
        back_populates="recette",
        cascade="all, delete-orphan",
        order_by="RecetteFermentationLigne.ordre",
    )


class RecetteFermentationLigne(Base):
    __tablename__ = "RecetteFermentationLigne"

    id_ligne        = Column(Integer, primary_key=True, autoincrement=True)
    id_recette_ferm = Column(Integer, ForeignKey("RecetteFermentation.id_recette_ferm"), nullable=False)
    id_produit      = Column(Integer, ForeignKey("ProduitEngrais.id_produit"), nullable=False)
    quantite        = Column(Float,      nullable=False, default=0.0)
    unite           = Column(String(10), nullable=True)   # mL | L | g | Kg
    note_ligne      = Column(String(500), nullable=True)
    ordre           = Column(Integer,    default=0)

    recette = relationship("RecetteFermentation", back_populates="lignes")
    produit = relationship("ProduitEngrais")


# ============ Suivi des Sols Vivants ============

class SuiviSolVivant(Base):
    __tablename__ = "SuiviSolVivant"

    id_suivi        = Column(Integer,     primary_key=True, autoincrement=True)
    nom_pot         = Column(String(200), nullable=False)          # nom libre du pot
    id_materiel     = Column(Integer,     ForeignKey("Materiel.id_materiel"), nullable=True)
    id_recette_lso  = Column(Integer,     ForeignKey("RecetteLSO.id_recette_lso"), nullable=True)
    volume_pot_l    = Column(Float,       nullable=True)           # volume du pot en L
    date_preparation = Column(Date,       nullable=True)
    commentaires    = Column(Text,        nullable=True)

    materiel     = relationship("Materiel")
    recette_lso  = relationship("RecetteLSO")
    reamendements = relationship("SuiviReamendement",  back_populates="suivi", cascade="all, delete-orphan", order_by="SuiviReamendement.date_application")
    arrosages     = relationship("SuiviArrosage",      back_populates="suivi", cascade="all, delete-orphan", order_by="SuiviArrosage.date_application")
    tcos          = relationship("SuiviTCO",           back_populates="suivi", cascade="all, delete-orphan", order_by="SuiviTCO.date_application")
    fermentations = relationship("SuiviFermentation",  back_populates="suivi", cascade="all, delete-orphan", order_by="SuiviFermentation.date_application")
    cultures      = relationship("SuiviCulture",       back_populates="suivi", cascade="all, delete-orphan", order_by="SuiviCulture.date_debut")


class SuiviReamendement(Base):
    __tablename__ = "SuiviReamendement"

    id_suivi_reamend    = Column(Integer, primary_key=True, autoincrement=True)
    id_suivi            = Column(Integer, ForeignKey("SuiviSolVivant.id_suivi"), nullable=False)
    id_recette_reamend  = Column(Integer, ForeignKey("RecetteReamendement.id_recette_reamend"), nullable=True)
    date_application    = Column(Date,   nullable=True)
    notes               = Column(Text,   nullable=True)

    suivi            = relationship("SuiviSolVivant", back_populates="reamendements")
    recette_reamend  = relationship("RecetteReamendement")


class SuiviArrosage(Base):
    __tablename__ = "SuiviArrosage"

    id_suivi_arrosage   = Column(Integer, primary_key=True, autoincrement=True)
    id_suivi            = Column(Integer, ForeignKey("SuiviSolVivant.id_suivi"), nullable=False)
    id_recette_engrais  = Column(Integer, ForeignKey("RecetteEngrais.id_recette"), nullable=True)
    volume_eau_l        = Column(Float,  nullable=True)   # volume d'eau appliqué en L
    date_application    = Column(Date,   nullable=True)
    notes               = Column(Text,   nullable=True)

    suivi            = relationship("SuiviSolVivant", back_populates="arrosages")
    recette_engrais  = relationship("RecetteEngrais")


class SuiviTCO(Base):
    __tablename__ = "SuiviTCO"

    id_suivi_tco     = Column(Integer, primary_key=True, autoincrement=True)
    id_suivi         = Column(Integer, ForeignKey("SuiviSolVivant.id_suivi"), nullable=False)
    id_recette_tco   = Column(Integer, ForeignKey("RecetteTCO.id_recette_tco"), nullable=True)
    volume_applique  = Column(Float,  nullable=True)   # volume en L
    date_application = Column(Date,   nullable=True)
    notes            = Column(Text,   nullable=True)

    suivi        = relationship("SuiviSolVivant", back_populates="tcos")
    recette_tco  = relationship("RecetteTCO")


class SuiviFermentation(Base):
    __tablename__ = "SuiviFermentation"

    id_suivi_ferm    = Column(Integer, primary_key=True, autoincrement=True)
    id_suivi         = Column(Integer, ForeignKey("SuiviSolVivant.id_suivi"), nullable=False)
    id_recette_ferm  = Column(Integer, ForeignKey("RecetteFermentation.id_recette_ferm"), nullable=True)
    volume_applique  = Column(Float,  nullable=True)   # volume en L
    date_application = Column(Date,   nullable=True)
    notes            = Column(Text,   nullable=True)

    suivi           = relationship("SuiviSolVivant", back_populates="fermentations")
    recette_ferm    = relationship("RecetteFermentation")


class SuiviCulture(Base):
    __tablename__ = "SuiviCulture"

    id_suivi_culture = Column(Integer, primary_key=True, autoincrement=True)
    id_suivi         = Column(Integer, ForeignKey("SuiviSolVivant.id_suivi"), nullable=False)
    description      = Column(String(500), nullable=True)   # nom/description de la culture
    date_debut       = Column(Date,   nullable=True)
    date_fin         = Column(Date,   nullable=True)
    notes            = Column(Text,   nullable=True)

    suivi = relationship("SuiviSolVivant", back_populates="cultures")


# ============ Espaces de culture ============

class EspaceCulture(Base):
    __tablename__ = "EspaceCulture"

    id_espace             = Column(Integer,     primary_key=True, autoincrement=True)
    nom                   = Column(String(200), nullable=False)
    type_espace           = Column(String(50),  nullable=True)    # Tente | Box | Armoire | Chambre | Outdoor…
    id_materiel_principal = Column(Integer, ForeignKey("Materiel.id_materiel"), nullable=True)
    dimensions            = Column(String(100), nullable=True)    # ex: "60x60x160 cm"
    surface_m2            = Column(Float,       nullable=True)    # surface en m²
    hauteur_cm            = Column(Integer,     nullable=True)    # hauteur utile en cm
    statut                = Column(String(50),  nullable=True, default="Actif")  # Actif | Inactif | Maintenance
    notes                 = Column(Text,        nullable=True)

    materiel_principal = relationship("Materiel", foreign_keys=[id_materiel_principal])

    equipements = relationship(
        "EspaceMateriel",
        back_populates="espace",
        cascade="all, delete-orphan",
    )


class EspaceMateriel(Base):
    """Association Espace ↔ Matériel : un item de matériel assigné à un espace."""
    __tablename__ = "EspaceMateriel"

    id_espace_materiel = Column(Integer, primary_key=True, autoincrement=True)
    id_espace          = Column(Integer, ForeignKey("EspaceCulture.id_espace"), nullable=False)
    id_materiel        = Column(Integer, ForeignKey("Materiel.id_materiel"),    nullable=False)
    date_assignation   = Column(Date,        nullable=True)
    notes              = Column(String(500), nullable=True)

    espace   = relationship("EspaceCulture", back_populates="equipements")
    materiel = relationship("Materiel")


# ============ Plans de culture ============

class PlanCulture(Base):
    """Plan de préparation d'une future culture (sélection de variétés + pots)."""
    __tablename__ = "PlanCulture"

    id_plan     = Column(Integer,     primary_key=True, autoincrement=True)
    nom         = Column(String(200), nullable=False)
    id_espace   = Column(Integer, ForeignKey("EspaceCulture.id_espace"), nullable=True)
    statut      = Column(String(20),  nullable=True, default="brouillon")  # brouillon | pret | lance
    notes       = Column(Text,        nullable=True)
    created_at  = Column(DateTime,    nullable=True, default=datetime.utcnow)
    updated_at  = Column(DateTime,    nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)

    espace   = relationship("EspaceCulture")
    varietes = relationship(
        "PlanCultureVariete",
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanCultureVariete.ordre",
    )


class PlanCultureVariete(Base):
    """Ligne d'un plan de culture : une variété (pack graine) avec nb plantes et taille de pot."""
    __tablename__ = "PlanCultureVariete"

    id_plan_variete = Column(Integer, primary_key=True, autoincrement=True)
    id_plan         = Column(Integer, ForeignKey("PlanCulture.id_plan", ondelete="CASCADE"), nullable=False)
    id_packgraine   = Column(Integer, ForeignKey("PackGraine.id_packgraine"), nullable=False)
    nb_plantes      = Column(Integer,       nullable=False, default=1)
    taille_pot_l    = Column(DECIMAL(6, 1), nullable=True)   # volume pot souhaité (L)
    ordre           = Column(Integer,       nullable=True, default=0)

    plan        = relationship("PlanCulture", back_populates="varietes")
    packgraine  = relationship("PackGraine")


# ============ Préparation substrat ============

class PreparationSubstrat(Base):
    """Historique des préparations de substrat (calcul de mélanges de sol)."""
    __tablename__ = "PreparationSubstrat"

    id_preparation     = Column(Integer,      primary_key=True, autoincrement=True)
    date_preparation   = Column(Date,          nullable=False, default=date.today)
    volume_total_l     = Column(DECIMAL(8, 2), nullable=False)
    type_sol           = Column(String(100),   nullable=True)
    id_recette_lso     = Column(Integer, ForeignKey("RecetteLSO.id_recette_lso"), nullable=True)
    nom_recette_lso    = Column(String(200),   nullable=True)   # dénormalisé pour historique stable
    configuration_pots = Column(Text,          nullable=True)   # JSON : [{volume_l, nb}]
    resultat           = Column(Text,          nullable=True)   # JSON : [{label, quantite, unite}]
    notes              = Column(Text,          nullable=True)
    created_at         = Column(DateTime,      nullable=True, default=datetime.utcnow)

    recette_lso = relationship("RecetteLSO")


# ============ Classement des variétés ============

class NotationVariete(Base):
    """Notation d'une variété selon deux grandes parties : Culture (/30) et Consommation (/70)."""
    __tablename__ = "NotationVariete"

    id_notation        = Column(Integer,      primary_key=True, autoincrement=True)
    nom_variete        = Column(String(255),  nullable=False)       # Nom libre (pas FK Variete)
    breeder            = Column(String(255),  nullable=True)
    date_notation      = Column(Date,         nullable=False, default=date.today)

    # ── Partie A : Culture (/30) ─────────────────────────────────────────────
    # Chaque note sur 10 (autorisées à 1 décimale près)
    vigueur_sante         = Column(Float, nullable=True)   # /10 — résistance maladies + stabilité génétique
    productivite_structure = Column(Float, nullable=True)  # /10 — rendement + ratio feuilles/fleurs
    soif                  = Column(Float, nullable=True)   # /10 — besoin en eau : peu gourmand = meilleure tournure

    # ── Partie B : Consommation (/70) ────────────────────────────────────────
    apparence_structure   = Column(Float, nullable=True)   # /15 — densité, trichomes, couleurs
    profil_aromatique     = Column(Float, nullable=True)   # /15 — intensité, complexité
    saveur_qualite        = Column(Float, nullable=True)   # /20 — fidélité, douceur, persistance
    effet_puissance       = Column(Float, nullable=True)   # /20 — force, qualité, entourage

    # ── Données labo (informatif, n'impactent pas la note) ───────────────────
    taux_thc              = Column(Float,       nullable=True)   # %
    taux_cbd              = Column(Float,       nullable=True)   # %
    terpene_dominant      = Column(String(500), nullable=True)   # CSV des terpènes sélectionnés
    commentaire_labo      = Column(Text,        nullable=True)
    notes_generales       = Column(Text,        nullable=True)

    created_at = Column(DateTime, nullable=True, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=True, default=datetime.utcnow, onupdate=datetime.utcnow)


# ============ Vaporisateurs ============

class Vaporisateur(Base):
    """Vaporisateur personnel avec toutes ses caractéristiques techniques."""
    __tablename__ = "Vaporisateur"

    id_vaporisateur   = Column(Integer,      primary_key=True, autoincrement=True)
    nom               = Column(String(200),  nullable=False)   # Auto : "$marque $modele #n"
    modele            = Column(String(100),  nullable=True)
    marque            = Column(String(100),  nullable=True)
    site_achat        = Column(String(200),  nullable=True)
    date_achat        = Column(Date,         nullable=True)
    prix_achat        = Column(DECIMAL(10, 2), nullable=True)
    numero_serie      = Column(String(100),  nullable=True)    # S/N

    # Chauffe
    type_chauffe      = Column(String(50),   nullable=True)    # conduction | convection | mixte | induction
    a_eau             = Column(Boolean,      nullable=True, default=False)   # avec chambre eau
    temp_min          = Column(Integer,      nullable=True)    # °C
    temp_max          = Column(Integer,      nullable=True)    # °C

    # Compatibilités (CSV : fleurs_sechees,resines,concentres)
    compatibilites    = Column(String(200),  nullable=True)

    # Batterie & charge
    type_batterie     = Column(String(50),   nullable=True)    # integree | amovible_18650
    autonomie_sessions = Column(Integer,     nullable=True)    # nb sessions moyennes
    autonomie_mah     = Column(Integer,      nullable=True)    # capacité mAh
    temps_chauffe_s   = Column(Integer,      nullable=True)    # secondes
    type_charge       = Column(String(50),   nullable=True)    # usb_c | proprietaire | autre

    # Usage
    nbr_sessions      = Column(Integer,      nullable=True, default=0)
    notes             = Column(Text,         nullable=True)
    created_at        = Column(DateTime,     nullable=True, default=datetime.utcnow)

    # Relations
    consommables = relationship(
        "VapoConsommable",
        back_populates="vaporisateur",
        cascade="all, delete-orphan",
    )


class VapoConsommable(Base):
    """Consommable ou accessoire lié à un vaporisateur (bol, terps ball, etc.)."""
    __tablename__ = "VapoConsommable"

    id_consommable    = Column(Integer,      primary_key=True, autoincrement=True)
    id_vaporisateur   = Column(Integer, ForeignKey("Vaporisateur.id_vaporisateur", ondelete="SET NULL"), nullable=True)
    type_consommable  = Column(String(100),  nullable=False)   # bol céramique, bol saphir, terps ball, etc.
    diametre_mm       = Column(Float,        nullable=True)    # pour terps balls
    matiere           = Column(String(50),   nullable=True)    # ceramique | saphir | SiC | quartz | titane | acier
    date_achat        = Column(Date,         nullable=True)
    prix_achat        = Column(DECIMAL(10, 2), nullable=True)
    notes             = Column(Text,         nullable=True)
    created_at        = Column(DateTime,     nullable=True, default=datetime.utcnow)

    # Relations
    vaporisateur = relationship("Vaporisateur", back_populates="consommables")


# ============ Sessions de séchage ============

class SessionSechage(Base):
    """Session de séchage indépendante de la culture d'origine."""
    __tablename__ = "SessionSechage"

    id_session_sechage = Column(Integer, primary_key=True, autoincrement=True)
    id_espace          = Column(Integer, ForeignKey("EspaceCulture.id_espace"), nullable=True)
    nom                = Column(String(200), nullable=True)          # ex: "Séchage Tente B - Avril 2026"
    methode_sechage    = Column(String(50),  nullable=True)          # Filet | Penderie | Rack
    temperature_cible  = Column(Float,       nullable=True)          # °C cible
    humidite_cible     = Column(Float,       nullable=True)          # %RH cible
    statut             = Column(String(50),  nullable=True, default="active")  # active | terminee
    date_debut         = Column(Date,        nullable=True)
    date_fin           = Column(Date,        nullable=True)
    notes              = Column(Text,        nullable=True)
    created_at         = Column(DateTime,    nullable=True, default=datetime.utcnow)

    espace = relationship("EspaceCulture")
    plants = relationship("PlantSechage", back_populates="session", cascade="all, delete-orphan")


class PlantSechage(Base):
    """Liaison Plant ↔ SessionSechage : une plante placée en séchage."""
    __tablename__ = "PlantSechage"

    id_plant_sechage   = Column(Integer, primary_key=True, autoincrement=True)
    id_plant           = Column(Integer, ForeignKey("Plant.id_plant", ondelete="CASCADE"), nullable=False)
    id_session_sechage = Column(Integer, ForeignKey("SessionSechage.id_session_sechage", ondelete="CASCADE"), nullable=False)
    date_mise_sechage  = Column(Date,          nullable=True)
    date_fin_sechage   = Column(Date,          nullable=True)
    poids_humide_g     = Column(DECIMAL(10, 2), nullable=True)   # poids frais à la récolte
    poids_sec_g        = Column(DECIMAL(10, 2), nullable=True)   # poids en fin de séchage
    notes              = Column(Text,          nullable=True)

    plant   = relationship("Plant")
    session = relationship("SessionSechage", back_populates="plants")


# ============ Sessions de curing ============

class SessionCuring(Base):
    """Session de curing indépendante — bocal, sac, grove bag…"""
    __tablename__ = "SessionCuring"

    id_session_curing  = Column(Integer, primary_key=True, autoincrement=True)
    nom                = Column(String(200), nullable=True)          # ex: "Curing OG Kush - Bocal 1L"
    type_contenant     = Column(String(50),  nullable=True)          # Bocal | Grove Bag | Sac sous vide | Autre
    volume_contenant_l = Column(DECIMAL(6, 2), nullable=True)       # volume en litres
    boveda_rh          = Column(Integer,     nullable=True)          # % du sachet Boveda (58, 62…)
    id_espace          = Column(Integer, ForeignKey("EspaceCulture.id_espace"), nullable=True)  # espace si curing dans un espace de culture
    id_materiel_bocal  = Column(Integer, ForeignKey("Materiel.id_materiel"), nullable=True)     # bocal sélectionné depuis l'inventaire
    statut             = Column(String(50),  nullable=True, default="active")  # active | terminee
    date_debut         = Column(Date,        nullable=True)
    date_fin           = Column(Date,        nullable=True)
    notes              = Column(Text,        nullable=True)
    created_at         = Column(DateTime,    nullable=True, default=datetime.utcnow)

    plants         = relationship("PlantCuring", back_populates="session", cascade="all, delete-orphan")
    espace         = relationship("EspaceCulture", foreign_keys=[id_espace])
    materiel_bocal = relationship("Materiel", foreign_keys=[id_materiel_bocal])


class PlantCuring(Base):
    """Liaison Plant ↔ SessionCuring : une plante placée en curing."""
    __tablename__ = "PlantCuring"

    id_plant_curing    = Column(Integer, primary_key=True, autoincrement=True)
    id_plant           = Column(Integer, ForeignKey("Plant.id_plant", ondelete="CASCADE"), nullable=False)
    id_session_curing  = Column(Integer, ForeignKey("SessionCuring.id_session_curing", ondelete="CASCADE"), nullable=False)
    date_mise_curing   = Column(Date,          nullable=True)
    date_fin_curing    = Column(Date,          nullable=True)
    poids_debut_g      = Column(DECIMAL(10, 2), nullable=True)   # poids en entrée de curing
    poids_final_g      = Column(DECIMAL(10, 2), nullable=True)   # poids en fin de curing (prêt)
    notes              = Column(Text,          nullable=True)

    plant   = relationship("Plant")
    session = relationship("SessionCuring", back_populates="plants")


# ============ Croisements & Pollen ============

class Pollen(Base):
    """Stock de pollen collecté — d'un mâle ou d'une femelle reversée (STS)."""
    __tablename__ = "Pollen"

    id_pollen           = Column(Integer, primary_key=True, autoincrement=True)
    nom_pollen          = Column(String(255), nullable=False)            # ex: "Gelato#3 - avril 2026"
    id_variete_source   = Column(Integer, ForeignKey("Variete.id_variete"), nullable=True)
    pheno_source        = Column(String(100), nullable=True)             # ex: "pheno #3"
    reverse             = Column(Boolean, default=False)                 # true = femelle reversée au STS
    date_collecte       = Column(Date, nullable=True)
    quantite_initiale_g = Column(DECIMAL(6, 3), nullable=True)
    quantite_restante_g = Column(DECIMAL(6, 3), nullable=True)
    stockage            = Column(String(50), nullable=True)              # frigo | congelateur | ambiant
    date_peremption     = Column(Date, nullable=True)                    # auto-calculée à la création
    actif               = Column(Boolean, default=True)                  # false si épuisé ou périmé
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime, nullable=True, default=datetime.utcnow)

    variete_source = relationship("Variete", foreign_keys=[id_variete_source])
    croisements    = relationship("Croisement", back_populates="pollen")


class Croisement(Base):
    """Croisement entre une mère (plante/variété) et un père (pollen ou variété saisie)."""
    __tablename__ = "Croisement"

    id_croisement       = Column(Integer, primary_key=True, autoincrement=True)
    nom_croisement      = Column(String(255), nullable=False)            # ex: "Gelato33 × Zkittlez F1"
    type_croisement     = Column(String(20), nullable=True)              # F1 | F2 | BX | S1 | IBL | polyhybrid

    # ─── Mère ─────────────────────────────────────────────────────────────────
    id_variete_mere     = Column(Integer, ForeignKey("Variete.id_variete"), nullable=True)
    pheno_mere          = Column(String(100), nullable=True)
    notes_mere          = Column(Text, nullable=True)

    # ─── Père (soit via pollen stock, soit saisie directe de variété) ─────────
    id_pollen           = Column(Integer, ForeignKey("Pollen.id_pollen"), nullable=True)
    id_variete_pere     = Column(Integer, ForeignKey("Variete.id_variete"), nullable=True)
    pheno_pere          = Column(String(100), nullable=True)
    pere_reverse        = Column(Boolean, default=False)                 # true si S1/F1 féminisé
    notes_pere          = Column(Text, nullable=True)

    # ─── Pollinisation ────────────────────────────────────────────────────────
    date_pollinisation  = Column(Date, nullable=True)
    methode             = Column(String(30), nullable=True)              # plante_entiere | branche_isolee | pinceau
    zone_pollinisee     = Column(String(255), nullable=True)
    quantite_pollen_utilisee_g = Column(DECIMAL(6, 3), nullable=True)

    # ─── Résultat graines ─────────────────────────────────────────────────────
    date_recolte_graines = Column(Date, nullable=True)
    nb_graines           = Column(Integer, nullable=True)
    qualite_graines      = Column(String(20), nullable=True)             # bonne | moyenne | immature
    poids_graines_g      = Column(DECIMAL(6, 2), nullable=True)

    # ─── Sorties auto ─────────────────────────────────────────────────────────
    id_variete_resultat    = Column(Integer, ForeignKey("Variete.id_variete"), nullable=True)
    id_packgraine_resultat = Column(Integer, ForeignKey("PackGraine.id_packgraine"), nullable=True)

    # ─── Meta ────────────────────────────────────────────────────────────────
    statut              = Column(String(20), default="planifie")         # planifie | pollinise | maturation | recolte | echec
    notes               = Column(Text, nullable=True)
    created_at          = Column(DateTime, nullable=True, default=datetime.utcnow)

    # Relations
    variete_mere     = relationship("Variete", foreign_keys=[id_variete_mere])
    variete_pere     = relationship("Variete", foreign_keys=[id_variete_pere])
    variete_resultat = relationship("Variete", foreign_keys=[id_variete_resultat])
    pollen           = relationship("Pollen", back_populates="croisements")
    packgraine_resultat = relationship("PackGraine", foreign_keys=[id_packgraine_resultat])


# ============ Sessions de consommation ============

class SessionConsommation(Base):
    """Enregistre une session de consommation avec un vaporisateur."""
    __tablename__ = "SessionConsommation"

    id_session        = Column(Integer,      primary_key=True, autoincrement=True)
    date_heure        = Column(DateTime,     nullable=False, default=datetime.utcnow)
    id_vaporisateur   = Column(Integer,      ForeignKey("Vaporisateur.id_vaporisateur", ondelete="SET NULL"), nullable=True)
    type_produit      = Column(String(20),   nullable=False)   # fleur | hash | rosin
    id_stock          = Column(Integer,      ForeignKey("Stock.id_stock", ondelete="SET NULL"), nullable=True)
    quantite_g        = Column(DECIMAL(6, 3), nullable=False)  # grammes consommés
    options_vapo      = Column(JSON,         nullable=True)    # {nb_ballons, temp_c, remplissage, nb_taffs, type_chauffe, …}
    notes             = Column(Text,         nullable=True)
    created_at        = Column(DateTime,     nullable=True, default=datetime.utcnow)

    # Relations
    vaporisateur = relationship("Vaporisateur")
    stock        = relationship("Stock")


class AppSettings(Base):
    """Paramètres applicatifs clé/valeur (valeurs uniques, ex: prix kWh)."""
    __tablename__ = "AppSettings"

    id     = Column(Integer, primary_key=True, autoincrement=True)
    cle    = Column(String(100), nullable=False, unique=True)
    valeur = Column(String(500), nullable=True)
    label  = Column(String(200), nullable=True)   # libellé affiché dans l'UI


# ============ Photos (Feature 8 — V3) ============

class Photo(Base):
    """Photo attachée à une plante et/ou une culture."""
    __tablename__ = "Photo"

    id_photo       = Column(Integer,      primary_key=True, autoincrement=True)
    filename       = Column(String(255),  nullable=False)           # nom unique sur disque
    filepath       = Column(String(500),  nullable=False)           # chemin relatif uploads/photos/
    thumbnail_path = Column(String(500),  nullable=True)            # chemin relatif uploads/photos/thumbs/
    date_prise     = Column(DateTime,     nullable=False, default=datetime.utcnow)
    notes          = Column(Text,         nullable=True)
    id_plant       = Column(Integer,      ForeignKey("Plant.id_plant",    ondelete="SET NULL"), nullable=True)
    id_culture     = Column(Integer,      ForeignKey("Culture.id_culture", ondelete="SET NULL"), nullable=True)
    taille_ko      = Column(Integer,      nullable=True)
    largeur_px     = Column(Integer,      nullable=True)
    hauteur_px     = Column(Integer,      nullable=True)
    created_at     = Column(DateTime,     nullable=True, default=datetime.utcnow)

    # Relations
    plant   = relationship("Plant")
    culture = relationship("Culture")


# ============ Alertes stock (Feature G — V4) ============

class StockAlertSeuil(Base):
    """Seuils d'alerte par type de stock. Extensible a tous les types (Hash, Rosin...)."""
    __tablename__ = "StockAlertSeuil"

    type_stock      = Column(String(50),     primary_key=True)
    seuil_bocal_g   = Column(DECIMAL(10, 2), nullable=True)
    seuil_bocal_pct = Column(DECIMAL(5, 1),  nullable=True)
    seuil_total_g   = Column(DECIMAL(10, 2), nullable=True)
    actif           = Column(Boolean,        nullable=False, default=True)
