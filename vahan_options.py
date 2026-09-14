"""Hằng số và danh mục option thực tế cho toàn bộ selector trên Vahan Public Report.
Được trích xuất trực tiếp từ live DOM https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en
Dùng để chọn filter trong code automation mà không sợ sai chính tả.
"""

class ReportTypeOptions:
    """Tất cả 4 options của #reportType"""
    CALENDAR_YEAR = '0'  # CALENDAR YEAR
    FINANCIAL_YEAR = '1'  # FINANCIAL YEAR
    LAST_1_YEAR = '4'  # Last 1 Year
    OPT_1_MONTH_FLEXIBLE = '9'  # 1 Month Flexible

    ALL_VALUES = ['0', '1', '4', '9']
    ALL_LABELS = ['CALENDAR YEAR', 'FINANCIAL YEAR', 'Last 1 Year', '1 Month Flexible']


class FinancialYearSelectOptions:
    """Tất cả 58 options của #financialYearSelect"""
    OPT_2026_2027 = '2026-2027'  # 2026-2027
    OPT_2025_2026 = '2025-2026'  # 2025-2026
    OPT_2024_2025 = '2024-2025'  # 2024-2025
    OPT_2023_2024 = '2023-2024'  # 2023-2024
    OPT_2022_2023 = '2022-2023'  # 2022-2023
    OPT_2021_2022 = '2021-2022'  # 2021-2022
    OPT_2020_2021 = '2020-2021'  # 2020-2021
    OPT_2019_2020 = '2019-2020'  # 2019-2020
    OPT_2018_2019 = '2018-2019'  # 2018-2019
    OPT_2017_2018 = '2017-2018'  # 2017-2018
    OPT_2016_2017 = '2016-2017'  # 2016-2017
    OPT_2015_2016 = '2015-2016'  # 2015-2016
    OPT_2014_2015 = '2014-2015'  # 2014-2015
    OPT_2013_2014 = '2013-2014'  # 2013-2014
    OPT_2012_2013 = '2012-2013'  # 2012-2013
    OPT_2011_2012 = '2011-2012'  # 2011-2012
    OPT_2010_2011 = '2010-2011'  # 2010-2011
    OPT_2009_2010 = '2009-2010'  # 2009-2010
    OPT_2008_2009 = '2008-2009'  # 2008-2009
    OPT_2007_2008 = '2007-2008'  # 2007-2008
    OPT_2006_2007 = '2006-2007'  # 2006-2007
    OPT_2005_2006 = '2005-2006'  # 2005-2006
    OPT_2004_2005 = '2004-2005'  # 2004-2005
    OPT_2003_2004 = '2003-2004'  # 2003-2004
    OPT_2002_2003 = '2002-2003'  # 2002-2003
    OPT_2001_2002 = '2001-2002'  # 2001-2002
    OPT_2000_2001 = '2000-2001'  # 2000-2001
    OPT_1999_2000 = '1999-2000'  # 1999-2000
    OPT_1998_1999 = '1998-1999'  # 1998-1999
    OPT_1997_1998 = '1997-1998'  # 1997-1998
    OPT_1996_1997 = '1996-1997'  # 1996-1997
    OPT_1995_1996 = '1995-1996'  # 1995-1996
    OPT_1994_1995 = '1994-1995'  # 1994-1995
    OPT_1993_1994 = '1993-1994'  # 1993-1994
    OPT_1992_1993 = '1992-1993'  # 1992-1993
    OPT_1991_1992 = '1991-1992'  # 1991-1992
    OPT_1990_1991 = '1990-1991'  # 1990-1991
    OPT_1989_1990 = '1989-1990'  # 1989-1990
    OPT_1988_1989 = '1988-1989'  # 1988-1989
    OPT_1987_1988 = '1987-1988'  # 1987-1988
    OPT_1986_1987 = '1986-1987'  # 1986-1987
    OPT_1985_1986 = '1985-1986'  # 1985-1986
    OPT_1984_1985 = '1984-1985'  # 1984-1985
    OPT_1983_1984 = '1983-1984'  # 1983-1984
    OPT_1982_1983 = '1982-1983'  # 1982-1983
    OPT_1981_1982 = '1981-1982'  # 1981-1982
    OPT_1980_1981 = '1980-1981'  # 1980-1981
    OPT_1979_1980 = '1979-1980'  # 1979-1980
    OPT_1978_1979 = '1978-1979'  # 1978-1979
    OPT_1977_1978 = '1977-1978'  # 1977-1978
    OPT_1976_1977 = '1976-1977'  # 1976-1977
    OPT_1975_1976 = '1975-1976'  # 1975-1976
    OPT_1974_1975 = '1974-1975'  # 1974-1975
    OPT_1973_1974 = '1973-1974'  # 1973-1974
    OPT_1972_1973 = '1972-1973'  # 1972-1973
    OPT_1971_1972 = '1971-1972'  # 1971-1972
    OPT_1970_1971 = '1970-1971'  # 1970-1971
    OPT_1969_1970 = '1969-1970'  # 1969-1970

    ALL_VALUES = ['2026-2027', '2025-2026', '2024-2025', '2023-2024', '2022-2023', '2021-2022', '2020-2021', '2019-2020', '2018-2019', '2017-2018', '2016-2017', '2015-2016', '2014-2015', '2013-2014', '2012-2013', '2011-2012', '2010-2011', '2009-2010', '2008-2009', '2007-2008', '2006-2007', '2005-2006', '2004-2005', '2003-2004', '2002-2003', '2001-2002', '2000-2001', '1999-2000', '1998-1999', '1997-1998', '1996-1997', '1995-1996', '1994-1995', '1993-1994', '1992-1993', '1991-1992', '1990-1991', '1989-1990', '1988-1989', '1987-1988', '1986-1987', '1985-1986', '1984-1985', '1983-1984', '1982-1983', '1981-1982', '1980-1981', '1979-1980', '1978-1979', '1977-1978', '1976-1977', '1975-1976', '1974-1975', '1973-1974', '1972-1973', '1971-1972', '1970-1971', '1969-1970']
    ALL_LABELS = ['2026-2027', '2025-2026', '2024-2025', '2023-2024', '2022-2023', '2021-2022', '2020-2021', '2019-2020', '2018-2019', '2017-2018', '2016-2017', '2015-2016', '2014-2015', '2013-2014', '2012-2013', '2011-2012', '2010-2011', '2009-2010', '2008-2009', '2007-2008', '2006-2007', '2005-2006', '2004-2005', '2003-2004', '2002-2003', '2001-2002', '2000-2001', '1999-2000', '1998-1999', '1997-1998', '1996-1997', '1995-1996', '1994-1995', '1993-1994', '1992-1993', '1991-1992', '1990-1991', '1989-1990', '1988-1989', '1987-1988', '1986-1987', '1985-1986', '1984-1985', '1983-1984', '1982-1983', '1981-1982', '1980-1981', '1979-1980', '1978-1979', '1977-1978', '1976-1977', '1975-1976', '1974-1975', '1973-1974', '1972-1973', '1971-1972', '1970-1971', '1969-1970']


class StateNameOptions:
    """Tất cả 36 options của #stateName"""
    ANDAMAN_NICOBAR_ISLAND = 'AN'  # Andaman & Nicobar Island
    ANDHRA_PRADESH = 'AP'  # Andhra Pradesh
    ARUNACHAL_PRADESH = 'AR'  # Arunachal Pradesh
    ASSAM = 'AS'  # Assam
    BIHAR = 'BR'  # Bihar
    CHANDIGARH = 'CH'  # Chandigarh
    CHHATTISGARH = 'CG'  # Chhattisgarh
    DELHI = 'DL'  # Delhi
    GOA = 'GA'  # Goa
    GUJARAT = 'GJ'  # Gujarat
    HARYANA = 'HR'  # Haryana
    HIMACHAL_PRADESH = 'HP'  # Himachal Pradesh
    JAMMU_KASHMIR = 'JK'  # Jammu & Kashmir
    JHARKHAND = 'JH'  # Jharkhand
    KARNATAKA = 'KA'  # Karnataka
    KERALA = 'KL'  # Kerala
    LADAKH = 'LA'  # Ladakh
    LAKSHADWEEP = 'LD'  # Lakshadweep
    MADHYA_PRADESH = 'MP'  # Madhya Pradesh
    MAHARASHTRA = 'MH'  # Maharashtra
    MANIPUR = 'MN'  # Manipur
    MEGHALAYA = 'ML'  # Meghalaya
    MIZORAM = 'MZ'  # Mizoram
    NAGALAND = 'NL'  # Nagaland
    ODISHA = 'OR'  # Odisha
    PUDUCHERRY = 'PY'  # Puducherry
    PUNJAB = 'PB'  # Punjab
    RAJASTHAN = 'RJ'  # Rajasthan
    SIKKIM = 'SK'  # Sikkim
    TAMIL_NADU = 'TN'  # Tamil Nadu
    TELANGANA = 'TG'  # Telangana
    TRIPURA = 'TR'  # Tripura
    UT_OF_DNH_AND_DD = 'DD'  # UT of DNH and DD
    UTTAR_PRADESH = 'UP'  # Uttar Pradesh
    UTTARAKHAND = 'UK'  # Uttarakhand
    WEST_BENGAL = 'WB'  # West Bengal

    ALL_VALUES = ['AN', 'AP', 'AR', 'AS', 'BR', 'CH', 'CG', 'DL', 'GA', 'GJ', 'HR', 'HP', 'JK', 'JH', 'KA', 'KL', 'LA', 'LD', 'MP', 'MH', 'MN', 'ML', 'MZ', 'NL', 'OR', 'PY', 'PB', 'RJ', 'SK', 'TN', 'TG', 'TR', 'DD', 'UP', 'UK', 'WB']
    ALL_LABELS = ['Andaman & Nicobar Island', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu & Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'UT of DNH and DD', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']


class RtoCodeOptions:
    """Tất cả 0 options của #rtoCode"""

    ALL_VALUES = []
    ALL_LABELS = []


class VehicleEmissionOptions:
    """Tất cả 26 options của #vehicleEmission"""
    BHARAT_STAGE_I = 'BHARAT STAGE I'  # BHARAT STAGE I
    BHARAT_STAGE_II = 'BHARAT STAGE II'  # BHARAT STAGE II
    BHARAT_STAGE_III = 'BHARAT STAGE III'  # BHARAT STAGE III
    BHARAT_STAGE_III_IV = 'BHARAT STAGE III/IV'  # BHARAT STAGE III/IV
    BHARAT_STAGE_IV = 'BHARAT STAGE IV'  # BHARAT STAGE IV
    BHARAT_STAGE_VI = 'BHARAT STAGE VI'  # BHARAT STAGE VI
    BHARAT_TREM_STAGE_III = 'Bharat  Trem  Stage III'  # Bharat Trem Stage III
    BHARAT_TREM_STAGE_III_A = 'Bharat  Trem  Stage III A'  # Bharat Trem Stage III A
    BHARAT_TREM_STAGE_III_B = 'Bharat  Trem  Stage III B'  # Bharat Trem Stage III B
    BHARAT_STAGE_III_CEV = 'Bharat Stage III  CEV'  # Bharat Stage III CEV
    CEV_STAGE_IV = 'CEV STAGE IV'  # CEV STAGE IV
    CEV_STAGE_V = 'CEV STAGE V'  # CEV STAGE V
    EURO_6AD = 'EURO  6AD'  # EURO 6AD
    EURO_1 = 'EURO 1'  # EURO 1
    EURO_2 = 'EURO 2'  # EURO 2
    EURO_3 = 'EURO 3'  # EURO 3
    EURO_4 = 'EURO 4'  # EURO 4
    EURO_6 = 'EURO 6'  # EURO 6
    EURO_6A = 'EURO 6A'  # EURO 6A
    EURO_6B = 'EURO 6B'  # EURO 6B
    EURO_6C = 'EURO 6C'  # EURO 6C
    EURO_6D = 'EURO 6D'  # EURO 6D
    NOT_APPLICABLE = 'Not Applicable'  # Not Applicable
    NOT_AVAILABLE = 'Not Available'  # Not Available
    TREM_STAGE_IV = 'TREM STAGE IV'  # TREM STAGE IV
    TREM_STAGE_V = 'TREM STAGE V'  # TREM STAGE V

    ALL_VALUES = ['BHARAT STAGE I', 'BHARAT STAGE II', 'BHARAT STAGE III', 'BHARAT STAGE III/IV', 'BHARAT STAGE IV', 'BHARAT STAGE VI', 'Bharat  Trem  Stage III', 'Bharat  Trem  Stage III A', 'Bharat  Trem  Stage III B', 'Bharat Stage III  CEV', 'CEV STAGE IV', 'CEV STAGE V', 'EURO  6AD', 'EURO 1', 'EURO 2', 'EURO 3', 'EURO 4', 'EURO 6', 'EURO 6A', 'EURO 6B', 'EURO 6C', 'EURO 6D', 'Not Applicable', 'Not Available', 'TREM STAGE IV', 'TREM STAGE V']
    ALL_LABELS = ['BHARAT STAGE I', 'BHARAT STAGE II', 'BHARAT STAGE III', 'BHARAT STAGE III/IV', 'BHARAT STAGE IV', 'BHARAT STAGE VI', 'Bharat Trem Stage III', 'Bharat Trem Stage III A', 'Bharat Trem Stage III B', 'Bharat Stage III CEV', 'CEV STAGE IV', 'CEV STAGE V', 'EURO 6AD', 'EURO 1', 'EURO 2', 'EURO 3', 'EURO 4', 'EURO 6', 'EURO 6A', 'EURO 6B', 'EURO 6C', 'EURO 6D', 'Not Applicable', 'Not Available', 'TREM STAGE IV', 'TREM STAGE V']


class VehicleMakerOptions:
    """Tất cả 5 options của #vehicleMaker"""
    OPT_3EV_INDUSTRIES_PVT_LTD = '3EV INDUSTRIES PVT LTD'  # 3EV INDUSTRIES PVT LTD
    OPT_3GB_TECHNOLOGY_PVT_LTD = '3GB TECHNOLOGY PVT LTD'  # 3GB TECHNOLOGY PVT LTD
    OPT_3S_INDUSTRIES_PRIVATE_LIMITED = '3S INDUSTRIES PRIVATE LIMITED'  # 3S INDUSTRIES PRIVATE LIMITED
    OPT_786_ENGINEERING_WORKS_AP105382023 = '786 ENGINEERING WORKS AP105382023'  # 786 ENGINEERING WORKS AP105382023
    A_AND_Z_MOTOR_CO_P_LTD = 'A AND Z MOTOR CO P LTD'  # A AND Z MOTOR CO P LTD

    ALL_VALUES = ['3EV INDUSTRIES PVT LTD', '3GB TECHNOLOGY PVT LTD', '3S INDUSTRIES PRIVATE LIMITED', '786 ENGINEERING WORKS AP105382023', 'A AND Z MOTOR CO P LTD']
    ALL_LABELS = ['3EV INDUSTRIES PVT LTD', '3GB TECHNOLOGY PVT LTD', '3S INDUSTRIES PRIVATE LIMITED', '786 ENGINEERING WORKS AP105382023', 'A AND Z MOTOR CO P LTD']


class VehicleCategoryGroupOptions:
    """Tất cả 11 options của #vehicleCategoryGroup"""
    AMBULANCE_HEARSES = 'Ambulance/Hearses'  # Ambulance/Hearses
    BUS = 'Bus'  # Bus
    CONSTRUCTION_EQUIPMENT_VEHICLE = 'Construction Equipment Vehicle'  # Construction Equipment Vehicle
    GOODS_VEHICLE = 'Goods Vehicle'  # Goods Vehicle
    TRACTOR = 'Tractor'  # Tractor
    PUBLIC_SERVICE_VEHICLE = 'Public Service Vehicle'  # Public Service Vehicle
    SPECIAL_CATEGORY_VEHICLES = 'Special Category Vehicles'  # Special Category Vehicles
    TRAILER = 'Trailer'  # Trailer
    FOUR_WHEELER = 'Four Wheeler'  # Four Wheeler
    THREE_WHEELER = 'Three Wheeler'  # Three Wheeler
    TWO_WHEELER = 'Two Wheeler'  # Two Wheeler

    ALL_VALUES = ['Ambulance/Hearses', 'Bus', 'Construction Equipment Vehicle', 'Goods Vehicle', 'Tractor', 'Public Service Vehicle', 'Special Category Vehicles', 'Trailer', 'Four Wheeler', 'Three Wheeler', 'Two Wheeler']
    ALL_LABELS = ['Ambulance/Hearses', 'Bus', 'Construction Equipment Vehicle', 'Goods Vehicle', 'Tractor', 'Public Service Vehicle', 'Special Category Vehicles', 'Trailer', 'Four Wheeler', 'Three Wheeler', 'Two Wheeler']


class VehicleSubCategoryOptions:
    """Tất cả 17 options của #vehicleSubCategory"""
    FOUR_WHEELER_INVALID_CARRIAGE = 'FOUR WHEELER (Invalid Carriage)'  # FOUR WHEELER (Invalid Carriage)
    HEAVY_GOODS_VEHICLE = 'HEAVY GOODS VEHICLE'  # HEAVY GOODS VEHICLE
    HEAVY_MOTOR_VEHICLE = 'HEAVY MOTOR VEHICLE'  # HEAVY MOTOR VEHICLE
    HEAVY_PASSENGER_VEHICLE = 'HEAVY PASSENGER VEHICLE'  # HEAVY PASSENGER VEHICLE
    LIGHT_GOODS_VEHICLE = 'LIGHT GOODS VEHICLE'  # LIGHT GOODS VEHICLE
    LIGHT_MOTOR_VEHICLE = 'LIGHT MOTOR VEHICLE'  # LIGHT MOTOR VEHICLE
    LIGHT_PASSENGER_VEHICLE = 'LIGHT PASSENGER VEHICLE'  # LIGHT PASSENGER VEHICLE
    MEDIUM_GOODS_VEHICLE = 'MEDIUM GOODS VEHICLE'  # MEDIUM GOODS VEHICLE
    MEDIUM_MOTOR_VEHICLE = 'MEDIUM MOTOR VEHICLE'  # MEDIUM MOTOR VEHICLE
    MEDIUM_PASSENGER_VEHICLE = 'MEDIUM PASSENGER VEHICLE'  # MEDIUM PASSENGER VEHICLE
    OTHER_THAN_MENTIONED_ABOVE = 'OTHER THAN MENTIONED ABOVE'  # OTHER THAN MENTIONED ABOVE
    THREE_WHEELER_INVALID_CARRIAGE = 'THREE WHEELER (Invalid Carriage)'  # THREE WHEELER (Invalid Carriage)
    THREE_WHEELER_NT = 'THREE WHEELER(NT)'  # THREE WHEELER(NT)
    THREE_WHEELER_T = 'THREE WHEELER(T)'  # THREE WHEELER(T)
    TWO_WHEELER_INVALID_CARRIAGE = 'TWO WHEELER (Invalid Carriage)'  # TWO WHEELER (Invalid Carriage)
    TWO_WHEELER_NT = 'TWO WHEELER(NT)'  # TWO WHEELER(NT)
    TWO_WHEELER_T = 'TWO WHEELER(T)'  # TWO WHEELER(T)

    ALL_VALUES = ['FOUR WHEELER (Invalid Carriage)', 'HEAVY GOODS VEHICLE', 'HEAVY MOTOR VEHICLE', 'HEAVY PASSENGER VEHICLE', 'LIGHT GOODS VEHICLE', 'LIGHT MOTOR VEHICLE', 'LIGHT PASSENGER VEHICLE', 'MEDIUM GOODS VEHICLE', 'MEDIUM MOTOR VEHICLE', 'MEDIUM PASSENGER VEHICLE', 'OTHER THAN MENTIONED ABOVE', 'THREE WHEELER (Invalid Carriage)', 'THREE WHEELER(NT)', 'THREE WHEELER(T)', 'TWO WHEELER (Invalid Carriage)', 'TWO WHEELER(NT)', 'TWO WHEELER(T)']
    ALL_LABELS = ['FOUR WHEELER (Invalid Carriage)', 'HEAVY GOODS VEHICLE', 'HEAVY MOTOR VEHICLE', 'HEAVY PASSENGER VEHICLE', 'LIGHT GOODS VEHICLE', 'LIGHT MOTOR VEHICLE', 'LIGHT PASSENGER VEHICLE', 'MEDIUM GOODS VEHICLE', 'MEDIUM MOTOR VEHICLE', 'MEDIUM PASSENGER VEHICLE', 'OTHER THAN MENTIONED ABOVE', 'THREE WHEELER (Invalid Carriage)', 'THREE WHEELER(NT)', 'THREE WHEELER(T)', 'TWO WHEELER (Invalid Carriage)', 'TWO WHEELER(NT)', 'TWO WHEELER(T)']


class VehicleClassOptions:
    """Tất cả 76 options của #vehicleClass"""
    ADAPTED_VEHICLE = 'Adapted Vehicle'  # Adapted Vehicle
    AGRICULTURAL_TRACTOR = 'Agricultural Tractor'  # Agricultural Tractor
    AMBULANCE = 'Ambulance'  # Ambulance
    ANIMAL_AMBULANCE = 'Animal Ambulance'  # Animal Ambulance
    ARMOURED_SPECIALISED_VEHICLE = 'Armoured/Specialised Vehicle'  # Armoured/Specialised Vehicle
    ARTICULATED_VEHICLE = 'Articulated Vehicle'  # Articulated Vehicle
    AUXILIARY_TRAILER = 'Auxiliary Trailer'  # Auxiliary Trailer
    BREAKDOWN_VAN = 'Breakdown Van'  # Breakdown Van
    BULLDOZER = 'Bulldozer'  # Bulldozer
    BUS = 'Bus'  # Bus
    CAMPER_VAN_TRAILER = 'Camper Van / Trailer'  # Camper Van / Trailer
    CAMPER_VAN_TRAILER_PRIVATE_USE = 'Camper Van / Trailer (Private Use)'  # Camper Van / Trailer (Private Use)
    CASH_VAN = 'Cash Van'  # Cash Van
    CONSTRUCTION_EQUIPMENT_VEHICLE = 'Construction Equipment Vehicle'  # Construction Equipment Vehicle
    CONSTRUCTION_EQUIPMENT_VEHICLE_COMMERCIAL = 'Construction Equipment Vehicle (Commercial)'  # Construction Equipment Vehicle (Commercial)
    CRANE_MOUNTED_VEHICLE = 'Crane Mounted Vehicle'  # Crane Mounted Vehicle
    DUMPER = 'Dumper'  # Dumper
    EARTH_MOVING_EQUIPMENT = 'Earth Moving Equipment'  # Earth Moving Equipment
    EDUCATIONAL_INSTITUTION_BUS = 'Educational Institution Bus'  # Educational Institution Bus
    EXCAVATOR_COMMERCIAL = 'Excavator (Commercial)'  # Excavator (Commercial)
    EXCAVATOR_NT = 'Excavator (NT)'  # Excavator (NT)
    FIRE_FIGHTING_VEHICLE = 'Fire Fighting Vehicle'  # Fire Fighting Vehicle
    FIRE_TENDERS = 'Fire Tenders'  # Fire Tenders
    FORK_LIFT = 'Fork Lift'  # Fork Lift
    GOODS_CARRIER = 'Goods Carrier'  # Goods Carrier
    HARVESTER = 'Harvester'  # Harvester
    HEARSES = 'Hearses'  # Hearses
    LIBRARY_VAN = 'Library Van'  # Library Van
    LUXURY_CAB = 'Luxury Cab'  # Luxury Cab
    M_CYCLE_SCOOTER = 'M-Cycle/Scooter'  # M-Cycle/Scooter
    M_CYCLE_SCOOTER_WITH_SIDE_CAR = 'M-Cycle/Scooter-With Side Car'  # M-Cycle/Scooter-With Side Car
    MAXI_CAB = 'Maxi Cab'  # Maxi Cab
    MOBILE_CANTEEN = 'Mobile Canteen'  # Mobile Canteen
    MOBILE_CLINIC = 'Mobile Clinic'  # Mobile Clinic
    MOBILE_WORKSHOP = 'Mobile Workshop'  # Mobile Workshop
    MODULAR_HYDRAULIC_TRAILER = 'Modular Hydraulic Trailer'  # Modular Hydraulic Trailer
    MOPED = 'Moped'  # Moped
    MOTOR_CAB = 'Motor Cab'  # Motor Cab
    MOTOR_CAR = 'Motor Car'  # Motor Car
    MOTOR_CARAVAN = 'Motor Caravan'  # Motor Caravan
    MOTOR_CYCLE_SCOOTER_SIDECAR_T = 'Motor Cycle/Scooter-SideCar(T)'  # Motor Cycle/Scooter-SideCar(T)
    MOTOR_CYCLE_SCOOTER_USED_FOR_HIRE = 'Motor Cycle/Scooter-Used For Hire'  # Motor Cycle/Scooter-Used For Hire
    MOTOR_CYCLE_SCOOTER_WITH_TRAILER = 'Motor Cycle/Scooter-With Trailer'  # Motor Cycle/Scooter-With Trailer
    MOTORISED_CYCLE_CC_25CC = 'Motorised Cycle (CC  25cc)'  # Motorised Cycle (CC 25cc)
    OMNI_BUS = 'Omni Bus'  # Omni Bus
    OMNI_BUS_PRIVATE_USE = 'Omni Bus (Private Use)'  # Omni Bus (Private Use)
    POWER_TILLER = 'Power Tiller'  # Power Tiller
    POWER_TILLER_COMMERCIAL = 'Power Tiller (Commercial)'  # Power Tiller (Commercial)
    PRIVATE_SERVICE_VEHICLE = 'Private Service Vehicle'  # Private Service Vehicle
    PRIVATE_SERVICE_VEHICLE_INDIVIDUAL_USE = 'Private Service Vehicle (Individual Use)'  # Private Service Vehicle (Individual Use)
    PULLER_TRACTOR = 'Puller Tractor'  # Puller Tractor
    QUADRICYCLE_COMMERCIAL = 'Quadricycle (Commercial)'  # Quadricycle (Commercial)
    QUADRICYCLE_PRIVATE = 'Quadricycle (Private)'  # Quadricycle (Private)
    RECOVERY_VEHICLE = 'Recovery Vehicle'  # Recovery Vehicle
    ROAD_ROLLER = 'Road Roller'  # Road Roller
    SCHOOL_BUS = 'School Bus'  # School Bus
    SEMI_TRAILER_COMMERCIAL = 'Semi-Trailer (Commercial)'  # Semi-Trailer (Commercial)
    SNORKED_LADDERS = 'Snorked Ladders'  # Snorked Ladders
    THREE_WHEELER_GOODS = 'Three Wheeler (Goods)'  # Three Wheeler (Goods)
    THREE_WHEELER_PASSENGER = 'Three Wheeler (Passenger)'  # Three Wheeler (Passenger)
    THREE_WHEELER_PERSONAL = 'Three Wheeler (Personal)'  # Three Wheeler (Personal)
    TOW_TRUCK = 'Tow Truck'  # Tow Truck
    TOWER_WAGON = 'Tower Wagon'  # Tower Wagon
    TRACTOR_COMMERCIAL = 'Tractor (Commercial)'  # Tractor (Commercial)
    TRACTOR_TROLLEY_COMMERCIAL = 'Tractor-Trolley(Commercial)'  # Tractor-Trolley(Commercial)
    TRAILER_AGRICULTURAL = 'Trailer (Agricultural)'  # Trailer (Agricultural)
    TRAILER_COMMERCIAL = 'Trailer (Commercial)'  # Trailer (Commercial)
    TRAILER_FOR_PERSONAL_USE = 'Trailer For Personal Use'  # Trailer For Personal Use
    TREE_TRIMMING_VEHICLE = 'Tree Trimming Vehicle'  # Tree Trimming Vehicle
    VEHICLE_FITTED_WITH_COMPRESSOR = 'Vehicle Fitted With Compressor'  # Vehicle Fitted With Compressor
    VEHICLE_FITTED_WITH_GENERATOR = 'Vehicle Fitted With Generator'  # Vehicle Fitted With Generator
    VEHICLE_FITTED_WITH_RIG = 'Vehicle Fitted With Rig'  # Vehicle Fitted With Rig
    VINTAGE_MOTOR_VEHICLE = 'Vintage Motor Vehicle'  # Vintage Motor Vehicle
    X_RAY_VAN = 'X-Ray Van'  # X-Ray Van
    E_RICKSHAW_WITH_CART_G = 'e-Rickshaw with Cart (G)'  # e-Rickshaw with Cart (G)
    E_RICKSHAW_P = 'e-Rickshaw(P)'  # e-Rickshaw(P)

    ALL_VALUES = ['Adapted Vehicle', 'Agricultural Tractor', 'Ambulance', 'Animal Ambulance', 'Armoured/Specialised Vehicle', 'Articulated Vehicle', 'Auxiliary Trailer', 'Breakdown Van', 'Bulldozer', 'Bus', 'Camper Van / Trailer', 'Camper Van / Trailer (Private Use)', 'Cash Van', 'Construction Equipment Vehicle', 'Construction Equipment Vehicle (Commercial)', 'Crane Mounted Vehicle', 'Dumper', 'Earth Moving Equipment', 'Educational Institution Bus', 'Excavator (Commercial)', 'Excavator (NT)', 'Fire Fighting Vehicle', 'Fire Tenders', 'Fork Lift', 'Goods Carrier', 'Harvester', 'Hearses', 'Library Van', 'Luxury Cab', 'M-Cycle/Scooter', 'M-Cycle/Scooter-With Side Car', 'Maxi Cab', 'Mobile Canteen', 'Mobile Clinic', 'Mobile Workshop', 'Modular Hydraulic Trailer', 'Moped', 'Motor Cab', 'Motor Car', 'Motor Caravan', 'Motor Cycle/Scooter-SideCar(T)', 'Motor Cycle/Scooter-Used For Hire', 'Motor Cycle/Scooter-With Trailer', 'Motorised Cycle (CC  25cc)', 'Omni Bus', 'Omni Bus (Private Use)', 'Power Tiller', 'Power Tiller (Commercial)', 'Private Service Vehicle', 'Private Service Vehicle (Individual Use)', 'Puller Tractor', 'Quadricycle (Commercial)', 'Quadricycle (Private)', 'Recovery Vehicle', 'Road Roller', 'School Bus', 'Semi-Trailer (Commercial)', 'Snorked Ladders', 'Three Wheeler (Goods)', 'Three Wheeler (Passenger)', 'Three Wheeler (Personal)', 'Tow Truck', 'Tower Wagon', 'Tractor (Commercial)', 'Tractor-Trolley(Commercial)', 'Trailer (Agricultural)', 'Trailer (Commercial)', 'Trailer For Personal Use', 'Tree Trimming Vehicle', 'Vehicle Fitted With Compressor', 'Vehicle Fitted With Generator', 'Vehicle Fitted With Rig', 'Vintage Motor Vehicle', 'X-Ray Van', 'e-Rickshaw with Cart (G)', 'e-Rickshaw(P)']
    ALL_LABELS = ['Adapted Vehicle', 'Agricultural Tractor', 'Ambulance', 'Animal Ambulance', 'Armoured/Specialised Vehicle', 'Articulated Vehicle', 'Auxiliary Trailer', 'Breakdown Van', 'Bulldozer', 'Bus', 'Camper Van / Trailer', 'Camper Van / Trailer (Private Use)', 'Cash Van', 'Construction Equipment Vehicle', 'Construction Equipment Vehicle (Commercial)', 'Crane Mounted Vehicle', 'Dumper', 'Earth Moving Equipment', 'Educational Institution Bus', 'Excavator (Commercial)', 'Excavator (NT)', 'Fire Fighting Vehicle', 'Fire Tenders', 'Fork Lift', 'Goods Carrier', 'Harvester', 'Hearses', 'Library Van', 'Luxury Cab', 'M-Cycle/Scooter', 'M-Cycle/Scooter-With Side Car', 'Maxi Cab', 'Mobile Canteen', 'Mobile Clinic', 'Mobile Workshop', 'Modular Hydraulic Trailer', 'Moped', 'Motor Cab', 'Motor Car', 'Motor Caravan', 'Motor Cycle/Scooter-SideCar(T)', 'Motor Cycle/Scooter-Used For Hire', 'Motor Cycle/Scooter-With Trailer', 'Motorised Cycle (CC 25cc)', 'Omni Bus', 'Omni Bus (Private Use)', 'Power Tiller', 'Power Tiller (Commercial)', 'Private Service Vehicle', 'Private Service Vehicle (Individual Use)', 'Puller Tractor', 'Quadricycle (Commercial)', 'Quadricycle (Private)', 'Recovery Vehicle', 'Road Roller', 'School Bus', 'Semi-Trailer (Commercial)', 'Snorked Ladders', 'Three Wheeler (Goods)', 'Three Wheeler (Passenger)', 'Three Wheeler (Personal)', 'Tow Truck', 'Tower Wagon', 'Tractor (Commercial)', 'Tractor-Trolley(Commercial)', 'Trailer (Agricultural)', 'Trailer (Commercial)', 'Trailer For Personal Use', 'Tree Trimming Vehicle', 'Vehicle Fitted With Compressor', 'Vehicle Fitted With Generator', 'Vehicle Fitted With Rig', 'Vintage Motor Vehicle', 'X-Ray Van', 'e-Rickshaw with Cart (G)', 'e-Rickshaw(P)']


class VehicleFuelOptions:
    """Tất cả 34 options của #vehicleFuel"""
    BIO_CNG_BIO_GAS = 'BIO-CNG/BIO-GAS'  # BIO-CNG/BIO-GAS
    CNG_ONLY = 'CNG ONLY'  # CNG ONLY
    DI_METHYL_ETHER = 'DI-METHYL ETHER'  # DI-METHYL ETHER
    DIESEL = 'DIESEL'  # DIESEL
    DIESEL_HYBRID = 'DIESEL/HYBRID'  # DIESEL/HYBRID
    DUAL_DIESEL_BIO_CNG = 'DUAL DIESEL/BIO CNG'  # DUAL DIESEL/BIO CNG
    DUAL_DIESEL_CNG = 'DUAL DIESEL/CNG'  # DUAL DIESEL/CNG
    DUAL_DIESEL_LNG = 'DUAL DIESEL/LNG'  # DUAL DIESEL/LNG
    ELECTRIC_BOV = 'ELECTRIC(BOV)'  # ELECTRIC(BOV)
    ETHANOL_E100 = 'ETHANOL(E100)'  # ETHANOL(E100)
    FLEX_FUEL_BIO_DIESEL = 'FLEX-FUEL(BIO-DIESEL)'  # FLEX-FUEL(BIO-DIESEL)
    FLEX_FUEL_ETHANOL = 'FLEX-FUEL(ETHANOL)'  # FLEX-FUEL(ETHANOL)
    FUEL_CELL_HYDROGEN = 'FUEL CELL HYDROGEN'  # FUEL CELL HYDROGEN
    HCNG = 'HCNG'  # HCNG
    HYDROGEN_ICE = 'HYDROGEN(ICE)'  # HYDROGEN(ICE)
    LNG = 'LNG'  # LNG
    LPG_ONLY = 'LPG ONLY'  # LPG ONLY
    METHANOL = 'METHANOL'  # METHANOL
    NOT_APPLICABLE = 'NOT APPLICABLE'  # NOT APPLICABLE
    PETROL = 'PETROL'  # PETROL
    PETROL_E20 = 'PETROL(E20)'  # PETROL(E20)
    PETROL_E20_CNG = 'PETROL(E20)/CNG'  # PETROL(E20)/CNG
    PETROL_E20_HYBRID = 'PETROL(E20)/HYBRID'  # PETROL(E20)/HYBRID
    PETROL_E20_HYBRID_CNG = 'PETROL(E20)/HYBRID/CNG'  # PETROL(E20)/HYBRID/CNG
    PETROL_E20_LPG = 'PETROL(E20)/LPG'  # PETROL(E20)/LPG
    PETROL_CNG = 'PETROL/CNG'  # PETROL/CNG
    PETROL_HYBRID = 'PETROL/HYBRID'  # PETROL/HYBRID
    PETROL_HYBRID_CNG = 'PETROL/HYBRID/CNG'  # PETROL/HYBRID/CNG
    PETROL_LPG = 'PETROL/LPG'  # PETROL/LPG
    PETROL_METHANOL = 'PETROL/METHANOL'  # PETROL/METHANOL
    PLUG_IN_HYBRID_EV = 'PLUG-IN HYBRID EV'  # PLUG-IN HYBRID EV
    PURE_EV = 'PURE EV'  # PURE EV
    SOLAR = 'SOLAR'  # SOLAR
    STRONG_HYBRID_EV = 'STRONG HYBRID EV'  # STRONG HYBRID EV

    ALL_VALUES = ['BIO-CNG/BIO-GAS', 'CNG ONLY', 'DI-METHYL ETHER', 'DIESEL', 'DIESEL/HYBRID', 'DUAL DIESEL/BIO CNG', 'DUAL DIESEL/CNG', 'DUAL DIESEL/LNG', 'ELECTRIC(BOV)', 'ETHANOL(E100)', 'FLEX-FUEL(BIO-DIESEL)', 'FLEX-FUEL(ETHANOL)', 'FUEL CELL HYDROGEN', 'HCNG', 'HYDROGEN(ICE)', 'LNG', 'LPG ONLY', 'METHANOL', 'NOT APPLICABLE', 'PETROL', 'PETROL(E20)', 'PETROL(E20)/CNG', 'PETROL(E20)/HYBRID', 'PETROL(E20)/HYBRID/CNG', 'PETROL(E20)/LPG', 'PETROL/CNG', 'PETROL/HYBRID', 'PETROL/HYBRID/CNG', 'PETROL/LPG', 'PETROL/METHANOL', 'PLUG-IN HYBRID EV', 'PURE EV', 'SOLAR', 'STRONG HYBRID EV']
    ALL_LABELS = ['BIO-CNG/BIO-GAS', 'CNG ONLY', 'DI-METHYL ETHER', 'DIESEL', 'DIESEL/HYBRID', 'DUAL DIESEL/BIO CNG', 'DUAL DIESEL/CNG', 'DUAL DIESEL/LNG', 'ELECTRIC(BOV)', 'ETHANOL(E100)', 'FLEX-FUEL(BIO-DIESEL)', 'FLEX-FUEL(ETHANOL)', 'FUEL CELL HYDROGEN', 'HCNG', 'HYDROGEN(ICE)', 'LNG', 'LPG ONLY', 'METHANOL', 'NOT APPLICABLE', 'PETROL', 'PETROL(E20)', 'PETROL(E20)/CNG', 'PETROL(E20)/HYBRID', 'PETROL(E20)/HYBRID/CNG', 'PETROL(E20)/LPG', 'PETROL/CNG', 'PETROL/HYBRID', 'PETROL/HYBRID/CNG', 'PETROL/LPG', 'PETROL/METHANOL', 'PLUG-IN HYBRID EV', 'PURE EV', 'SOLAR', 'STRONG HYBRID EV']


class EvTypeOptions:
    """Tất cả 4 options của #evType"""
    ELECTRIC_BOV = 'ELECTRIC(BOV)'  # ELECTRIC(BOV)
    PLUG_IN_HYBRID_EV = 'PLUG-IN HYBRID EV'  # PLUG-IN HYBRID EV
    PURE_EV = 'PURE EV'  # PURE EV
    STRONG_HYBRID_EV = 'STRONG HYBRID EV'  # STRONG HYBRID EV

    ALL_VALUES = ['ELECTRIC(BOV)', 'PLUG-IN HYBRID EV', 'PURE EV', 'STRONG HYBRID EV']
    ALL_LABELS = ['ELECTRIC(BOV)', 'PLUG-IN HYBRID EV', 'PURE EV', 'STRONG HYBRID EV']


class VehicleStatusOptions:
    """Tất cả 11 options của #vehicleStatus"""
    ACTIVE = 'ACTIVE'  # ACTIVE
    CONFISCATED_AUCTION_VEHICLE = 'CONFISCATED AUCTION VEHICLE'  # CONFISCATED AUCTION VEHICLE
    NOC_ISSUED = 'NOC ISSUED'  # NOC ISSUED
    RC_CANCEL = 'RC CANCEL'  # RC CANCEL
    RC_SURRENDER = 'RC SURRENDER'  # RC SURRENDER
    RC_SUSPENDED = 'RC SUSPENDED'  # RC SUSPENDED
    SCRAP_VEHICLE = 'SCRAP VEHICLE'  # SCRAP VEHICLE
    VEHICLE_DE_REGISTERED = 'VEHICLE DE-REGISTERED'  # VEHICLE DE-REGISTERED
    VEHICLE_SUBMITTED_FOR_SCRAPPING = 'VEHICLE SUBMITTED FOR SCRAPPING'  # VEHICLE SUBMITTED FOR SCRAPPING
    VEHICLE_TO_BE_SCRAPPED = 'VEHICLE TO BE SCRAPPED'  # VEHICLE TO BE SCRAPPED
    VEHICLE_SCRAPPED_RC_CANCEL = 'VEHICLE_SCRAPPED RC CANCEL'  # VEHICLE_SCRAPPED RC CANCEL

    ALL_VALUES = ['ACTIVE', 'CONFISCATED AUCTION VEHICLE', 'NOC ISSUED', 'RC CANCEL', 'RC SURRENDER', 'RC SUSPENDED', 'SCRAP VEHICLE', 'VEHICLE DE-REGISTERED', 'VEHICLE SUBMITTED FOR SCRAPPING', 'VEHICLE TO BE SCRAPPED', 'VEHICLE_SCRAPPED RC CANCEL']
    ALL_LABELS = ['ACTIVE', 'CONFISCATED AUCTION VEHICLE', 'NOC ISSUED', 'RC CANCEL', 'RC SURRENDER', 'RC SUSPENDED', 'SCRAP VEHICLE', 'VEHICLE DE-REGISTERED', 'VEHICLE SUBMITTED FOR SCRAPPING', 'VEHICLE TO BE SCRAPPED', 'VEHICLE_SCRAPPED RC CANCEL']


class VehicleOwnerTypeOptions:
    """Tất cả 27 options của #vehicleOwnerType"""
    AUTONOMOUS_BODY = 'AUTONOMOUS BODY'  # AUTONOMOUS BODY
    CENTRAL_GOVERNMENT = 'CENTRAL GOVERNMENT'  # CENTRAL GOVERNMENT
    CHARITABLE_TRUST = 'CHARITABLE TRUST'  # CHARITABLE TRUST
    DIVYANGJAN_AVAILING_GST_CONCESSION = 'DIVYANGJAN (Availing GST Concession)'  # DIVYANGJAN (Availing GST Concession)
    DIVYANGJAN_WITHOUT_AVAILING_GST_CONCESSION = 'DIVYANGJAN (Without Availing GST Concession)'  # DIVYANGJAN (Without Availing GST Concession)
    DRAMA_TAMASHA_GROUPS = 'DRAMA/TAMASHA GROUPS'  # DRAMA/TAMASHA GROUPS
    DRIVING_TRAINING_SCHOOL = 'DRIVING TRAINING SCHOOL'  # DRIVING TRAINING SCHOOL
    EDUCATIONAL_INSTITUTE = 'EDUCATIONAL INSTITUTE'  # EDUCATIONAL INSTITUTE
    FIRM = 'FIRM'  # FIRM
    GOVERNMENT_BOARD = 'GOVERNMENT BOARD'  # GOVERNMENT BOARD
    GOVERNMENT_COMPANY = 'GOVERNMENT COMPANY'  # GOVERNMENT COMPANY
    GOVERNMENT_CORPORATION = 'GOVERNMENT CORPORATION'  # GOVERNMENT CORPORATION
    GOVERNMENT_DEPARTMENT = 'GOVERNMENT DEPARTMENT'  # GOVERNMENT DEPARTMENT
    GOVERNMENT_ENTITY = 'GOVERNMENT ENTITY'  # GOVERNMENT ENTITY
    GOVERNMENT_TRUST = 'GOVERNMENT TRUST'  # GOVERNMENT TRUST
    GOVT_UNDERTAKING = 'GOVT UNDERTAKING'  # GOVT UNDERTAKING
    INDIVIDUAL = 'INDIVIDUAL'  # INDIVIDUAL
    JOINT_STOCK_COMPANY = 'JOINT STOCK COMPANY'  # JOINT STOCK COMPANY
    LOCAL_AUTHORITY = 'LOCAL AUTHORITY'  # LOCAL AUTHORITY
    MULTIPLE_OWNER = 'MULTIPLE OWNER'  # MULTIPLE OWNER
    OTHERS = 'OTHERS'  # OTHERS
    POLICE_DEPARTMENT = 'POLICE DEPARTMENT'  # POLICE DEPARTMENT
    SCHOOL = 'SCHOOL'  # SCHOOL
    SOCIAL_WELFARE = 'SOCIAL WELFARE'  # SOCIAL WELFARE
    STATE_GOVERNMENT = 'STATE GOVERNMENT'  # STATE GOVERNMENT
    STATE_TRANSPORT_CORP_DEPT = 'STATE TRANSPORT CORP/DEPT'  # STATE TRANSPORT CORP/DEPT
    STATE_UNIVERSITIES = 'STATE UNIVERSITIES'  # STATE UNIVERSITIES

    ALL_VALUES = ['AUTONOMOUS BODY', 'CENTRAL GOVERNMENT', 'CHARITABLE TRUST', 'DIVYANGJAN (Availing GST Concession)', 'DIVYANGJAN (Without Availing GST Concession)', 'DRAMA/TAMASHA GROUPS', 'DRIVING TRAINING SCHOOL', 'EDUCATIONAL INSTITUTE', 'FIRM', 'GOVERNMENT BOARD', 'GOVERNMENT COMPANY', 'GOVERNMENT CORPORATION', 'GOVERNMENT DEPARTMENT', 'GOVERNMENT ENTITY', 'GOVERNMENT TRUST', 'GOVT UNDERTAKING', 'INDIVIDUAL', 'JOINT STOCK COMPANY', 'LOCAL AUTHORITY', 'MULTIPLE OWNER', 'OTHERS', 'POLICE DEPARTMENT', 'SCHOOL', 'SOCIAL WELFARE', 'STATE GOVERNMENT', 'STATE TRANSPORT CORP/DEPT', 'STATE UNIVERSITIES']
    ALL_LABELS = ['AUTONOMOUS BODY', 'CENTRAL GOVERNMENT', 'CHARITABLE TRUST', 'DIVYANGJAN (Availing GST Concession)', 'DIVYANGJAN (Without Availing GST Concession)', 'DRAMA/TAMASHA GROUPS', 'DRIVING TRAINING SCHOOL', 'EDUCATIONAL INSTITUTE', 'FIRM', 'GOVERNMENT BOARD', 'GOVERNMENT COMPANY', 'GOVERNMENT CORPORATION', 'GOVERNMENT DEPARTMENT', 'GOVERNMENT ENTITY', 'GOVERNMENT TRUST', 'GOVT UNDERTAKING', 'INDIVIDUAL', 'JOINT STOCK COMPANY', 'LOCAL AUTHORITY', 'MULTIPLE OWNER', 'OTHERS', 'POLICE DEPARTMENT', 'SCHOOL', 'SOCIAL WELFARE', 'STATE GOVERNMENT', 'STATE TRANSPORT CORP/DEPT', 'STATE UNIVERSITIES']


class VehicleTypeOptions:
    """Tất cả 3 options của #vehicleType"""
    SELECT_VEHICLE_TYPE = ''  # --- Select Vehicle Type ---
    TRANSPORT = 'Transport'  # Transport
    NON_TRANSPORT = 'Non-Transport'  # Non-Transport

    ALL_VALUES = ['Transport', 'Non-Transport']
    ALL_LABELS = ['--- Select Vehicle Type ---', 'Transport', 'Non-Transport']


class FitnessCheckOptions:
    """Tất cả 2 options của #fitnessCheck"""
    NO = '0'  # NO
    YES = '1'  # YES

    ALL_VALUES = ['0', '1']
    ALL_LABELS = ['NO', 'YES']


class DelhiNcrOptions:
    """Tất cả 2 options của #delhiNcr"""
    ALL_STATES = '0'  # ALL STATES
    YES = '1'  # YES

    ALL_VALUES = ['0', '1']
    ALL_LABELS = ['ALL STATES', 'YES']


class YAxisOptions:
    """Tất cả 15 options của #yAxis"""
    SELECT_Y_AXIS = ''  # --- Select Y-Axis ---
    VEHICLE_CATEGORY = 'vehicleCategoryDescription'  # Vehicle Category
    VEHICLE_CATEGORY_GROUP = 'vehicleCategoryGroup'  # Vehicle Category Group
    VEHICLE_CLASS = 'vehicleClass'  # Vehicle Class
    VEHICLE_TYPE = 'vehicleType'  # Vehicle Type 
    NORMS = 'vehiclePollutionNorm'  # Norms
    FUEL = 'vehicleFuel'  # Fuel
    MAKER = 'vehicleMakerName'  # Maker
    STATE_WISE = 'stateCode'  # State Wise
    RTO_WISE = 'rtoName'  # RTO Wise
    MANUFACTURING_YEAR = 'vehicleManufecturingYear'  # Manufacturing  Year
    FINANCIAL_YEAR = 'financialYear'  # Financial Year
    LAST_5_FINANCIAL_YEAR = 'last5FinancialYear'  # Last 5 FINANCIAL YEAR
    CALENDAR_YEAR = 'calendarYear'  # Calendar Year
    MONTH_WISE = 'monthWise'  # Month Wise

    ALL_VALUES = ['vehicleCategoryDescription', 'vehicleCategoryGroup', 'vehicleClass', 'vehicleType', 'vehiclePollutionNorm', 'vehicleFuel', 'vehicleMakerName', 'stateCode', 'rtoName', 'vehicleManufecturingYear', 'financialYear', 'last5FinancialYear', 'calendarYear', 'monthWise']
    ALL_LABELS = ['--- Select Y-Axis ---', 'Vehicle Category', 'Vehicle Category Group', 'Vehicle Class', 'Vehicle Type ', 'Norms', 'Fuel', 'Maker', 'State Wise', 'RTO Wise', 'Manufacturing  Year', 'Financial Year', 'Last 5 FINANCIAL YEAR', 'Calendar Year', 'Month Wise']


class XAxisOptions:
    """Tất cả 1 options của #xAxis"""
    SELECT_X_AXIS = ''  # --- Select X-Axis ---

    ALL_VALUES = []
    ALL_LABELS = ['--- Select X-Axis ---']

