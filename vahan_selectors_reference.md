# BẢNG TRA CỨU FULL SELECTORS & TẤT CẢ OPTIONS TRÊN VAHAN PUBLIC REPORT

> Tài liệu tổng hợp toàn bộ các option thực tế được soi trực tiếp từ DOM live của trang https://analytics.parivahan.gov.in/analytics/vahanpublicreport?lang=en

## Year Type (`reportType`)
- **Mô tả**: Dropdown chọn loại năm (Calendar Year, Financial Year, v.v.)
- **Selector**: `#reportType`
- **Kiểu điều khiển**: `Single Select (<select>)`
- **Tổng số options**: 4

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `0` | CALENDAR YEAR | ✅ |
| 2 | `1` | FINANCIAL YEAR |  |
| 3 | `4` | Last 1 Year |  |
| 4 | `9` | 1 Month Flexible |  |

---

## Financial Year (`financialYearSelect`)
- **Mô tả**: Multiselect chọn năm tài chính
- **Selector**: `xpath=//*[@id='financialYearSelect']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 58

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `2026-2027` | 2026-2027 |  |
| 2 | `2025-2026` | 2025-2026 |  |
| 3 | `2024-2025` | 2024-2025 |  |
| 4 | `2023-2024` | 2023-2024 |  |
| 5 | `2022-2023` | 2022-2023 |  |
| 6 | `2021-2022` | 2021-2022 |  |
| 7 | `2020-2021` | 2020-2021 |  |
| 8 | `2019-2020` | 2019-2020 |  |
| 9 | `2018-2019` | 2018-2019 |  |
| 10 | `2017-2018` | 2017-2018 |  |
| 11 | `2016-2017` | 2016-2017 |  |
| 12 | `2015-2016` | 2015-2016 |  |
| 13 | `2014-2015` | 2014-2015 |  |
| 14 | `2013-2014` | 2013-2014 |  |
| 15 | `2012-2013` | 2012-2013 |  |
| 16 | `2011-2012` | 2011-2012 |  |
| 17 | `2010-2011` | 2010-2011 |  |
| 18 | `2009-2010` | 2009-2010 |  |
| 19 | `2008-2009` | 2008-2009 |  |
| 20 | `2007-2008` | 2007-2008 |  |
| 21 | `2006-2007` | 2006-2007 |  |
| 22 | `2005-2006` | 2005-2006 |  |
| 23 | `2004-2005` | 2004-2005 |  |
| 24 | `2003-2004` | 2003-2004 |  |
| 25 | `2002-2003` | 2002-2003 |  |
| 26 | `2001-2002` | 2001-2002 |  |
| 27 | `2000-2001` | 2000-2001 |  |
| 28 | `1999-2000` | 1999-2000 |  |
| 29 | `1998-1999` | 1998-1999 |  |
| 30 | `1997-1998` | 1997-1998 |  |
| 31 | `1996-1997` | 1996-1997 |  |
| 32 | `1995-1996` | 1995-1996 |  |
| 33 | `1994-1995` | 1994-1995 |  |
| 34 | `1993-1994` | 1993-1994 |  |
| 35 | `1992-1993` | 1992-1993 |  |
| 36 | `1991-1992` | 1991-1992 |  |
| 37 | `1990-1991` | 1990-1991 |  |
| 38 | `1989-1990` | 1989-1990 |  |
| 39 | `1988-1989` | 1988-1989 |  |
| 40 | `1987-1988` | 1987-1988 |  |
| 41 | `1986-1987` | 1986-1987 |  |
| 42 | `1985-1986` | 1985-1986 |  |
| 43 | `1984-1985` | 1984-1985 |  |
| 44 | `1983-1984` | 1983-1984 |  |
| 45 | `1982-1983` | 1982-1983 |  |
| 46 | `1981-1982` | 1981-1982 |  |
| 47 | `1980-1981` | 1980-1981 |  |
| 48 | `1979-1980` | 1979-1980 |  |
| 49 | `1978-1979` | 1978-1979 |  |
| 50 | `1977-1978` | 1977-1978 |  |
| 51 | `1976-1977` | 1976-1977 |  |
| 52 | `1975-1976` | 1975-1976 |  |
| 53 | `1974-1975` | 1974-1975 |  |
| 54 | `1973-1974` | 1973-1974 |  |
| 55 | `1972-1973` | 1972-1973 |  |
| 56 | `1971-1972` | 1971-1972 |  |
| 57 | `1970-1971` | 1970-1971 |  |
| 58 | `1969-1970` | 1969-1970 |  |

---

## State (`stateName`)
- **Mô tả**: Multiselect chọn Bang / Toàn quốc (36 bang)
- **Selector**: `xpath=//*[@id='stateName']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 36

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `AN` | Andaman & Nicobar Island |  |
| 2 | `AP` | Andhra Pradesh |  |
| 3 | `AR` | Arunachal Pradesh |  |
| 4 | `AS` | Assam |  |
| 5 | `BR` | Bihar |  |
| 6 | `CH` | Chandigarh |  |
| 7 | `CG` | Chhattisgarh |  |
| 8 | `DL` | Delhi |  |
| 9 | `GA` | Goa |  |
| 10 | `GJ` | Gujarat |  |
| 11 | `HR` | Haryana |  |
| 12 | `HP` | Himachal Pradesh |  |
| 13 | `JK` | Jammu & Kashmir |  |
| 14 | `JH` | Jharkhand |  |
| 15 | `KA` | Karnataka |  |
| 16 | `KL` | Kerala |  |
| 17 | `LA` | Ladakh |  |
| 18 | `LD` | Lakshadweep |  |
| 19 | `MP` | Madhya Pradesh |  |
| 20 | `MH` | Maharashtra |  |
| 21 | `MN` | Manipur |  |
| 22 | `ML` | Meghalaya |  |
| 23 | `MZ` | Mizoram |  |
| 24 | `NL` | Nagaland |  |
| 25 | `OR` | Odisha |  |
| 26 | `PY` | Puducherry |  |
| 27 | `PB` | Punjab |  |
| 28 | `RJ` | Rajasthan |  |
| 29 | `SK` | Sikkim |  |
| 30 | `TN` | Tamil Nadu |  |
| 31 | `TG` | Telangana |  |
| 32 | `TR` | Tripura |  |
| 33 | `DD` | UT of DNH and DD |  |
| 34 | `UP` | Uttar Pradesh |  |
| 35 | `UK` | Uttarakhand |  |
| 36 | `WB` | West Bengal |  |

---

## RTO (`rtoCode`)
- **Mô tả**: Multiselect chọn RTO (phụ thuộc theo State được chọn)
- **Selector**: `xpath=//*[@id='rtoCode']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 0

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|

---

## Emission (`vehicleEmission`)
- **Mô tả**: Multiselect chọn chuẩn khí thải (26 chuẩn)
- **Selector**: `xpath=//*[@id='vehicleEmission']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 26

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `BHARAT STAGE I` | BHARAT STAGE I |  |
| 2 | `BHARAT STAGE II` | BHARAT STAGE II |  |
| 3 | `BHARAT STAGE III` | BHARAT STAGE III |  |
| 4 | `BHARAT STAGE III/IV` | BHARAT STAGE III/IV |  |
| 5 | `BHARAT STAGE IV` | BHARAT STAGE IV |  |
| 6 | `BHARAT STAGE VI` | BHARAT STAGE VI |  |
| 7 | `Bharat  Trem  Stage III` | Bharat Trem Stage III |  |
| 8 | `Bharat  Trem  Stage III A` | Bharat Trem Stage III A |  |
| 9 | `Bharat  Trem  Stage III B` | Bharat Trem Stage III B |  |
| 10 | `Bharat Stage III  CEV` | Bharat Stage III CEV |  |
| 11 | `CEV STAGE IV` | CEV STAGE IV |  |
| 12 | `CEV STAGE V` | CEV STAGE V |  |
| 13 | `EURO  6AD` | EURO 6AD |  |
| 14 | `EURO 1` | EURO 1 |  |
| 15 | `EURO 2` | EURO 2 |  |
| 16 | `EURO 3` | EURO 3 |  |
| 17 | `EURO 4` | EURO 4 |  |
| 18 | `EURO 6` | EURO 6 |  |
| 19 | `EURO 6A` | EURO 6A |  |
| 20 | `EURO 6B` | EURO 6B |  |
| 21 | `EURO 6C` | EURO 6C |  |
| 22 | `EURO 6D` | EURO 6D |  |
| 23 | `Not Applicable` | Not Applicable |  |
| 24 | `Not Available` | Not Available |  |
| 25 | `TREM STAGE IV` | TREM STAGE IV |  |
| 26 | `TREM STAGE V` | TREM STAGE V |  |

---

## Maker (`vehicleMaker`)
- **Mô tả**: Tìm kiếm và chọn nhà sản xuất xe (lazy loading AJAX)
- **Selector**: `xpath=//*[@id='vehicleMaker']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 5

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `3EV INDUSTRIES PVT LTD` | 3EV INDUSTRIES PVT LTD |  |
| 2 | `3GB TECHNOLOGY PVT LTD` | 3GB TECHNOLOGY PVT LTD |  |
| 3 | `3S INDUSTRIES PRIVATE LIMITED` | 3S INDUSTRIES PRIVATE LIMITED |  |
| 4 | `786 ENGINEERING WORKS AP105382023` | 786 ENGINEERING WORKS AP105382023 |  |
| 5 | `A AND Z MOTOR CO P LTD` | A AND Z MOTOR CO P LTD |  |

---

## Category Group (`vehicleCategoryGroup`)
- **Mô tả**: Multiselect chọn nhóm loại xe (11 nhóm)
- **Selector**: `xpath=//*[@id='vehicleCategoryGroup']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 11

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `Ambulance/Hearses` | Ambulance/Hearses |  |
| 2 | `Bus` | Bus |  |
| 3 | `Construction Equipment Vehicle` | Construction Equipment Vehicle |  |
| 4 | `Goods Vehicle` | Goods Vehicle |  |
| 5 | `Tractor` | Tractor |  |
| 6 | `Public Service Vehicle` | Public Service Vehicle |  |
| 7 | `Special Category Vehicles` | Special Category Vehicles |  |
| 8 | `Trailer` | Trailer |  |
| 9 | `Four Wheeler` | Four Wheeler |  |
| 10 | `Three Wheeler` | Three Wheeler |  |
| 11 | `Two Wheeler` | Two Wheeler |  |

---

## Sub-Category (`vehicleSubCategory`)
- **Mô tả**: Multiselect chọn phân nhóm xe (17 phân nhóm)
- **Selector**: `xpath=//*[@id='vehicleSubCategory']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 17

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `FOUR WHEELER (Invalid Carriage)` | FOUR WHEELER (Invalid Carriage) |  |
| 2 | `HEAVY GOODS VEHICLE` | HEAVY GOODS VEHICLE |  |
| 3 | `HEAVY MOTOR VEHICLE` | HEAVY MOTOR VEHICLE |  |
| 4 | `HEAVY PASSENGER VEHICLE` | HEAVY PASSENGER VEHICLE |  |
| 5 | `LIGHT GOODS VEHICLE` | LIGHT GOODS VEHICLE |  |
| 6 | `LIGHT MOTOR VEHICLE` | LIGHT MOTOR VEHICLE |  |
| 7 | `LIGHT PASSENGER VEHICLE` | LIGHT PASSENGER VEHICLE |  |
| 8 | `MEDIUM GOODS VEHICLE` | MEDIUM GOODS VEHICLE |  |
| 9 | `MEDIUM MOTOR VEHICLE` | MEDIUM MOTOR VEHICLE |  |
| 10 | `MEDIUM PASSENGER VEHICLE` | MEDIUM PASSENGER VEHICLE |  |
| 11 | `OTHER THAN MENTIONED ABOVE` | OTHER THAN MENTIONED ABOVE |  |
| 12 | `THREE WHEELER (Invalid Carriage)` | THREE WHEELER (Invalid Carriage) |  |
| 13 | `THREE WHEELER(NT)` | THREE WHEELER(NT) |  |
| 14 | `THREE WHEELER(T)` | THREE WHEELER(T) |  |
| 15 | `TWO WHEELER (Invalid Carriage)` | TWO WHEELER (Invalid Carriage) |  |
| 16 | `TWO WHEELER(NT)` | TWO WHEELER(NT) |  |
| 17 | `TWO WHEELER(T)` | TWO WHEELER(T) |  |

---

## Class (`vehicleClass`)
- **Mô tả**: Multiselect chọn hạng xe (76 hạng xe)
- **Selector**: `xpath=//*[@id='vehicleClass']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 76

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `Adapted Vehicle` | Adapted Vehicle |  |
| 2 | `Agricultural Tractor` | Agricultural Tractor |  |
| 3 | `Ambulance` | Ambulance |  |
| 4 | `Animal Ambulance` | Animal Ambulance |  |
| 5 | `Armoured/Specialised Vehicle` | Armoured/Specialised Vehicle |  |
| 6 | `Articulated Vehicle` | Articulated Vehicle |  |
| 7 | `Auxiliary Trailer` | Auxiliary Trailer |  |
| 8 | `Breakdown Van` | Breakdown Van |  |
| 9 | `Bulldozer` | Bulldozer |  |
| 10 | `Bus` | Bus |  |
| 11 | `Camper Van / Trailer` | Camper Van / Trailer |  |
| 12 | `Camper Van / Trailer (Private Use)` | Camper Van / Trailer (Private Use) |  |
| 13 | `Cash Van` | Cash Van |  |
| 14 | `Construction Equipment Vehicle` | Construction Equipment Vehicle |  |
| 15 | `Construction Equipment Vehicle (Commercial)` | Construction Equipment Vehicle (Commercial) |  |
| 16 | `Crane Mounted Vehicle` | Crane Mounted Vehicle |  |
| 17 | `Dumper` | Dumper |  |
| 18 | `Earth Moving Equipment` | Earth Moving Equipment |  |
| 19 | `Educational Institution Bus` | Educational Institution Bus |  |
| 20 | `Excavator (Commercial)` | Excavator (Commercial) |  |
| 21 | `Excavator (NT)` | Excavator (NT) |  |
| 22 | `Fire Fighting Vehicle` | Fire Fighting Vehicle |  |
| 23 | `Fire Tenders` | Fire Tenders |  |
| 24 | `Fork Lift` | Fork Lift |  |
| 25 | `Goods Carrier` | Goods Carrier |  |
| 26 | `Harvester` | Harvester |  |
| 27 | `Hearses` | Hearses |  |
| 28 | `Library Van` | Library Van |  |
| 29 | `Luxury Cab` | Luxury Cab |  |
| 30 | `M-Cycle/Scooter` | M-Cycle/Scooter |  |
| 31 | `M-Cycle/Scooter-With Side Car` | M-Cycle/Scooter-With Side Car |  |
| 32 | `Maxi Cab` | Maxi Cab |  |
| 33 | `Mobile Canteen` | Mobile Canteen |  |
| 34 | `Mobile Clinic` | Mobile Clinic |  |
| 35 | `Mobile Workshop` | Mobile Workshop |  |
| 36 | `Modular Hydraulic Trailer` | Modular Hydraulic Trailer |  |
| 37 | `Moped` | Moped |  |
| 38 | `Motor Cab` | Motor Cab |  |
| 39 | `Motor Car` | Motor Car |  |
| 40 | `Motor Caravan` | Motor Caravan |  |
| 41 | `Motor Cycle/Scooter-SideCar(T)` | Motor Cycle/Scooter-SideCar(T) |  |
| 42 | `Motor Cycle/Scooter-Used For Hire` | Motor Cycle/Scooter-Used For Hire |  |
| 43 | `Motor Cycle/Scooter-With Trailer` | Motor Cycle/Scooter-With Trailer |  |
| 44 | `Motorised Cycle (CC  25cc)` | Motorised Cycle (CC 25cc) |  |
| 45 | `Omni Bus` | Omni Bus |  |
| 46 | `Omni Bus (Private Use)` | Omni Bus (Private Use) |  |
| 47 | `Power Tiller` | Power Tiller |  |
| 48 | `Power Tiller (Commercial)` | Power Tiller (Commercial) |  |
| 49 | `Private Service Vehicle` | Private Service Vehicle |  |
| 50 | `Private Service Vehicle (Individual Use)` | Private Service Vehicle (Individual Use) |  |
| 51 | `Puller Tractor` | Puller Tractor |  |
| 52 | `Quadricycle (Commercial)` | Quadricycle (Commercial) |  |
| 53 | `Quadricycle (Private)` | Quadricycle (Private) |  |
| 54 | `Recovery Vehicle` | Recovery Vehicle |  |
| 55 | `Road Roller` | Road Roller |  |
| 56 | `School Bus` | School Bus |  |
| 57 | `Semi-Trailer (Commercial)` | Semi-Trailer (Commercial) |  |
| 58 | `Snorked Ladders` | Snorked Ladders |  |
| 59 | `Three Wheeler (Goods)` | Three Wheeler (Goods) |  |
| 60 | `Three Wheeler (Passenger)` | Three Wheeler (Passenger) |  |
| 61 | `Three Wheeler (Personal)` | Three Wheeler (Personal) |  |
| 62 | `Tow Truck` | Tow Truck |  |
| 63 | `Tower Wagon` | Tower Wagon |  |
| 64 | `Tractor (Commercial)` | Tractor (Commercial) |  |
| 65 | `Tractor-Trolley(Commercial)` | Tractor-Trolley(Commercial) |  |
| 66 | `Trailer (Agricultural)` | Trailer (Agricultural) |  |
| 67 | `Trailer (Commercial)` | Trailer (Commercial) |  |
| 68 | `Trailer For Personal Use` | Trailer For Personal Use |  |
| 69 | `Tree Trimming Vehicle` | Tree Trimming Vehicle |  |
| 70 | `Vehicle Fitted With Compressor` | Vehicle Fitted With Compressor |  |
| 71 | `Vehicle Fitted With Generator` | Vehicle Fitted With Generator |  |
| 72 | `Vehicle Fitted With Rig` | Vehicle Fitted With Rig |  |
| 73 | `Vintage Motor Vehicle` | Vintage Motor Vehicle |  |
| 74 | `X-Ray Van` | X-Ray Van |  |
| 75 | `e-Rickshaw with Cart (G)` | e-Rickshaw with Cart (G) |  |
| 76 | `e-Rickshaw(P)` | e-Rickshaw(P) |  |

---

## Fuel (`vehicleFuel`)
- **Mô tả**: Multiselect chọn loại nhiên liệu (34 loại)
- **Selector**: `xpath=//*[@id='vehicleFuel']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 34

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `BIO-CNG/BIO-GAS` | BIO-CNG/BIO-GAS |  |
| 2 | `CNG ONLY` | CNG ONLY |  |
| 3 | `DI-METHYL ETHER` | DI-METHYL ETHER |  |
| 4 | `DIESEL` | DIESEL |  |
| 5 | `DIESEL/HYBRID` | DIESEL/HYBRID |  |
| 6 | `DUAL DIESEL/BIO CNG` | DUAL DIESEL/BIO CNG |  |
| 7 | `DUAL DIESEL/CNG` | DUAL DIESEL/CNG |  |
| 8 | `DUAL DIESEL/LNG` | DUAL DIESEL/LNG |  |
| 9 | `ELECTRIC(BOV)` | ELECTRIC(BOV) |  |
| 10 | `ETHANOL(E100)` | ETHANOL(E100) |  |
| 11 | `FLEX-FUEL(BIO-DIESEL)` | FLEX-FUEL(BIO-DIESEL) |  |
| 12 | `FLEX-FUEL(ETHANOL)` | FLEX-FUEL(ETHANOL) |  |
| 13 | `FUEL CELL HYDROGEN` | FUEL CELL HYDROGEN |  |
| 14 | `HCNG` | HCNG |  |
| 15 | `HYDROGEN(ICE)` | HYDROGEN(ICE) |  |
| 16 | `LNG` | LNG |  |
| 17 | `LPG ONLY` | LPG ONLY |  |
| 18 | `METHANOL` | METHANOL |  |
| 19 | `NOT APPLICABLE` | NOT APPLICABLE |  |
| 20 | `PETROL` | PETROL |  |
| 21 | `PETROL(E20)` | PETROL(E20) |  |
| 22 | `PETROL(E20)/CNG` | PETROL(E20)/CNG |  |
| 23 | `PETROL(E20)/HYBRID` | PETROL(E20)/HYBRID |  |
| 24 | `PETROL(E20)/HYBRID/CNG` | PETROL(E20)/HYBRID/CNG |  |
| 25 | `PETROL(E20)/LPG` | PETROL(E20)/LPG |  |
| 26 | `PETROL/CNG` | PETROL/CNG |  |
| 27 | `PETROL/HYBRID` | PETROL/HYBRID |  |
| 28 | `PETROL/HYBRID/CNG` | PETROL/HYBRID/CNG |  |
| 29 | `PETROL/LPG` | PETROL/LPG |  |
| 30 | `PETROL/METHANOL` | PETROL/METHANOL |  |
| 31 | `PLUG-IN HYBRID EV` | PLUG-IN HYBRID EV |  |
| 32 | `PURE EV` | PURE EV |  |
| 33 | `SOLAR` | SOLAR |  |
| 34 | `STRONG HYBRID EV` | STRONG HYBRID EV |  |

---

## EV Type (`evType`)
- **Mô tả**: Multiselect chọn loại xe điện (4 loại)
- **Selector**: `xpath=//*[@id='evType']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 4

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `ELECTRIC(BOV)` | ELECTRIC(BOV) |  |
| 2 | `PLUG-IN HYBRID EV` | PLUG-IN HYBRID EV |  |
| 3 | `PURE EV` | PURE EV |  |
| 4 | `STRONG HYBRID EV` | STRONG HYBRID EV |  |

---

## Status (`vehicleStatus`)
- **Mô tả**: Multiselect chọn trạng thái xe (11 trạng thái)
- **Selector**: `xpath=//*[@id='vehicleStatus']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 11

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `ACTIVE` | ACTIVE |  |
| 2 | `CONFISCATED AUCTION VEHICLE` | CONFISCATED AUCTION VEHICLE |  |
| 3 | `NOC ISSUED` | NOC ISSUED |  |
| 4 | `RC CANCEL` | RC CANCEL |  |
| 5 | `RC SURRENDER` | RC SURRENDER |  |
| 6 | `RC SUSPENDED` | RC SUSPENDED |  |
| 7 | `SCRAP VEHICLE` | SCRAP VEHICLE |  |
| 8 | `VEHICLE DE-REGISTERED` | VEHICLE DE-REGISTERED |  |
| 9 | `VEHICLE SUBMITTED FOR SCRAPPING` | VEHICLE SUBMITTED FOR SCRAPPING |  |
| 10 | `VEHICLE TO BE SCRAPPED` | VEHICLE TO BE SCRAPPED |  |
| 11 | `VEHICLE_SCRAPPED RC CANCEL` | VEHICLE_SCRAPPED RC CANCEL |  |

---

## Owner Type (`vehicleOwnerType`)
- **Mô tả**: Multiselect chọn loại chủ sở hữu (27 loại)
- **Selector**: `xpath=//*[@id='vehicleOwnerType']/following::div[contains(@class,'multiselect-dropdown')][1]`
- **Kiểu điều khiển**: `Multiselect (Custom Dropdown)`
- **Tổng số options**: 27

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `AUTONOMOUS BODY` | AUTONOMOUS BODY |  |
| 2 | `CENTRAL GOVERNMENT` | CENTRAL GOVERNMENT |  |
| 3 | `CHARITABLE TRUST` | CHARITABLE TRUST |  |
| 4 | `DIVYANGJAN (Availing GST Concession)` | DIVYANGJAN (Availing GST Concession) |  |
| 5 | `DIVYANGJAN (Without Availing GST Concession)` | DIVYANGJAN (Without Availing GST Concession) |  |
| 6 | `DRAMA/TAMASHA GROUPS` | DRAMA/TAMASHA GROUPS |  |
| 7 | `DRIVING TRAINING SCHOOL` | DRIVING TRAINING SCHOOL |  |
| 8 | `EDUCATIONAL INSTITUTE` | EDUCATIONAL INSTITUTE |  |
| 9 | `FIRM` | FIRM |  |
| 10 | `GOVERNMENT BOARD` | GOVERNMENT BOARD |  |
| 11 | `GOVERNMENT COMPANY` | GOVERNMENT COMPANY |  |
| 12 | `GOVERNMENT CORPORATION` | GOVERNMENT CORPORATION |  |
| 13 | `GOVERNMENT DEPARTMENT` | GOVERNMENT DEPARTMENT |  |
| 14 | `GOVERNMENT ENTITY` | GOVERNMENT ENTITY |  |
| 15 | `GOVERNMENT TRUST` | GOVERNMENT TRUST |  |
| 16 | `GOVT UNDERTAKING` | GOVT UNDERTAKING |  |
| 17 | `INDIVIDUAL` | INDIVIDUAL |  |
| 18 | `JOINT STOCK COMPANY` | JOINT STOCK COMPANY |  |
| 19 | `LOCAL AUTHORITY` | LOCAL AUTHORITY |  |
| 20 | `MULTIPLE OWNER` | MULTIPLE OWNER |  |
| 21 | `OTHERS` | OTHERS |  |
| 22 | `POLICE DEPARTMENT` | POLICE DEPARTMENT |  |
| 23 | `SCHOOL` | SCHOOL |  |
| 24 | `SOCIAL WELFARE` | SOCIAL WELFARE |  |
| 25 | `STATE GOVERNMENT` | STATE GOVERNMENT |  |
| 26 | `STATE TRANSPORT CORP/DEPT` | STATE TRANSPORT CORP/DEPT |  |
| 27 | `STATE UNIVERSITIES` | STATE UNIVERSITIES |  |

---

## Type (`vehicleType`)
- **Mô tả**: Dropdown chọn phân loại xe
- **Selector**: `#vehicleType`
- **Kiểu điều khiển**: `Single Select (<select>)`
- **Tổng số options**: 3

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `` | --- Select Vehicle Type --- | ✅ |
| 2 | `Transport` | Transport |  |
| 3 | `Non-Transport` | Non-Transport |  |

---

## Fitness Valid as On Date? (`fitnessCheck`)
- **Mô tả**: Dropdown kiểm tra hạn đăng kiểm
- **Selector**: `#fitnessCheck`
- **Kiểu điều khiển**: `Single Select (<select>)`
- **Tổng số options**: 2

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `0` | NO | ✅ |
| 2 | `1` | YES |  |

---

## Delhi NCR ? (`delhiNcr`)
- **Mô tả**: Dropdown phạm vi Delhi NCR
- **Selector**: `#delhiNcr`
- **Kiểu điều khiển**: `Single Select (<select>)`
- **Tổng số options**: 2

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `0` | ALL STATES | ✅ |
| 2 | `1` | YES |  |

---

## Y-Axis (`yAxis`)
- **Mô tả**: Dropdown chọn trục tung pivot table (15 trục)
- **Selector**: `#yAxis`
- **Kiểu điều khiển**: `Single Select (<select>)`
- **Tổng số options**: 15

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `` | --- Select Y-Axis --- | ✅ |
| 2 | `vehicleCategoryDescription` | Vehicle Category |  |
| 3 | `vehicleCategoryGroup` | Vehicle Category Group |  |
| 4 | `vehicleClass` | Vehicle Class |  |
| 5 | `vehicleType` | Vehicle Type  |  |
| 6 | `vehiclePollutionNorm` | Norms |  |
| 7 | `vehicleFuel` | Fuel |  |
| 8 | `vehicleMakerName` | Maker |  |
| 9 | `stateCode` | State Wise |  |
| 10 | `rtoName` | RTO Wise |  |
| 11 | `vehicleManufecturingYear` | Manufacturing  Year |  |
| 12 | `financialYear` | Financial Year |  |
| 13 | `last5FinancialYear` | Last 5 FINANCIAL YEAR |  |
| 14 | `calendarYear` | Calendar Year |  |
| 15 | `monthWise` | Month Wise |  |

---

## X-Axis (`xAxis`)
- **Mô tả**: Dropdown chọn trục hoành pivot table (thay đổi linh hoạt theo Y-Axis)
- **Selector**: `#xAxis`
- **Kiểu điều khiển**: `Single Select (<select>)`
- **Tổng số options**: 1

| STT | Value (`value`) | Nhãn hiển thị (`label / text`) | Mặc định chọn? |
|---|---|---|---|
| 1 | `` | --- Select X-Axis --- | ✅ |

---
