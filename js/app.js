/* Abash demo — storage, i18n, router, all screens (SPA) */
(function () {
  const KEYS = {
    user: "abash_user",
    wishlist: "abash_wishlist",
    listings: "abash_user_listings",
    buildings: "abash_user_buildings",
    lang: "abash_lang",
    search: "abash_search",
    recentAreas: "abash_recent_areas",
    otp: "abash_otp_pending",
    members: "abash_property_members",
    listingPatches: "abash_listing_patches",
    accounts: "abash_accounts"
  };

  const mem = {};
  let otpMem = null;
  let refineOpen = false;

  function canStore() {
    try {
      const k = "__abash_t";
      localStorage.setItem(k, "1");
      localStorage.removeItem(k);
      return true;
    } catch {
      return false;
    }
  }
  const HAS_LS = canStore();

  function read(key, fallback) {
    try {
      if (HAS_LS) {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
      }
      return key in mem ? mem[key] : fallback;
    } catch {
      return key in mem ? mem[key] : fallback;
    }
  }
  function write(key, value) {
    mem[key] = value;
    try {
      if (HAS_LS) localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }
  function remove(key) {
    delete mem[key];
    try {
      if (HAS_LS) localStorage.removeItem(key);
    } catch (_) {}
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }
  function $all(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  const Abash = {
    route: { name: "home", params: {} },

    t(key) {
      const lang = Abash.getLang();
      const dict = (window.ABASH_I18N && window.ABASH_I18N[lang]) || {};
      return dict[key] || (window.ABASH_I18N && window.ABASH_I18N.en[key]) || key;
    },
    getLang() {
      return read(KEYS.lang, null) || "en";
    },
    setLang(lang) {
      write(KEYS.lang, lang);
      document.documentElement.lang = lang === "bn" ? "bn" : "en";
    },
    toggleLang() {
      Abash.setLang(Abash.getLang() === "en" ? "bn" : "en");
      Abash.render();
    },

    getUser() {
      return read(KEYS.user, null);
    },
    setUser(user) {
      write(KEYS.user, user);
    },
    logout() {
      remove(KEYS.user);
      Abash.go("home");
    },

    getWishlist() {
      return read(KEYS.wishlist, []);
    },
    isSaved(id) {
      return Abash.getWishlist().includes(id);
    },
    toggleSave(id) {
      if (!Abash.getUser()) {
        Abash.toast(Abash.getLang() === "bn" ? "সেভ করতে সাইন ইন করুন" : "Sign in to save places");
        Abash.go("login", { next: "wishlist" });
        return false;
      }
      let list = Abash.getWishlist();
      if (list.includes(id)) list = list.filter((x) => x !== id);
      else list.push(id);
      write(KEYS.wishlist, list);
      return list.includes(id);
    },

    getAllListings() {
      const patches = Abash.getListingPatches();
      return [...read(KEYS.listings, []), ...(window.ABASH_LISTINGS || [])].map((l) =>
        patches[l.id] ? { ...l, ...patches[l.id] } : l
      );
    },
    getListing(id) {
      return Abash.getAllListings().find((l) => l.id === id) || null;
    },
    addListing(listing) {
      const extra = read(KEYS.listings, []);
      extra.unshift(listing);
      write(KEYS.listings, extra);
    },
    removeMyListing(id) {
      write(
        KEYS.listings,
        read(KEYS.listings, []).filter((l) => l.id !== id)
      );
    },

    getBuildings() {
      const stored = read(KEYS.buildings, null);
      if (stored && stored.length) return stored;
      return (window.ABASH_DEMO_BUILDINGS || []).map((b) => ({ ...b }));
    },
    setBuildings(list) {
      write(KEYS.buildings, list);
    },
    addBuilding(b) {
      const list = Abash.getBuildings();
      list.unshift(b);
      write(KEYS.buildings, list);
    },
    updateBuilding(id, patch) {
      let list = Abash.getBuildings();
      const i = list.findIndex((x) => x.id === id);
      if (i < 0) return null;
      list[i] = { ...list[i], ...patch, id };
      write(KEYS.buildings, list);
      return list[i];
    },
    getBuilding(id) {
      return Abash.getBuildings().find((b) => b.id === id) || null;
    },

    normPhone(phone) {
      return String(phone || "").replace(/[^0-9]/g, "");
    },
    userIdFromPhone(phone) {
      return "u_" + Abash.normPhone(phone);
    },
    roleRank(role) {
      const r = Abash.normRole(role);
      if (r === "admin") return 3;
      if (r === "editor") return 2;
      return 0;
    },
    normRole(role) {
      if (role === "owner" || role === "admin") return "admin";
      if (role === "manager" || role === "caretaker" || role === "editor") return "editor";
      return role || null;
    },

    getAccounts() {
      const stored = read(KEYS.accounts, null);
      if (stored && Object.keys(stored).length) return stored;
      const seed = {};
      (window.ABASH_DEMO_ACCOUNTS || []).forEach((a) => {
        seed[Abash.normPhone(a.phone)] = {
          phone: a.phone,
          password: a.password,
          name: a.name,
          id: Abash.userIdFromPhone(a.phone)
        };
      });
      write(KEYS.accounts, seed);
      return seed;
    },
    saveAccounts(map) {
      write(KEYS.accounts, map);
    },
    findAccount(phone) {
      return Abash.getAccounts()[Abash.normPhone(phone)] || null;
    },
    registerAccount({ phone, password, name }) {
      const map = Abash.getAccounts();
      const n = Abash.normPhone(phone);
      if (map[n]) return { ok: false, error: "exists" };
      map[n] = {
        phone: String(phone).trim(),
        password,
        name: name || "User",
        id: Abash.userIdFromPhone(phone)
      };
      Abash.saveAccounts(map);
      return { ok: true, account: map[n] };
    },
    loginAccount(phone, password) {
      const acc = Abash.findAccount(phone);
      if (!acc || acc.password !== password) return { ok: false };
      return { ok: true, account: acc };
    },

    getMembers() {
      const stored = read(KEYS.members, null);
      const raw =
        stored && stored.length
          ? stored
          : (window.ABASH_DEMO_MEMBERS || []).map((m) => ({ ...m }));
      return raw.map((m) => ({ ...m, role: Abash.normRole(m.role) || m.role }));
    },
    setMembers(list) {
      write(KEYS.members, list);
    },
    membersForProperty(propertyId) {
      return Abash.getMembers().filter((m) => m.propertyId === propertyId);
    },
    membershipsForPhone(phone) {
      const n = Abash.normPhone(phone);
      return Abash.getMembers().filter((m) => Abash.normPhone(m.phone) === n);
    },
    roleOnProperty(user, propertyId) {
      if (!user || !propertyId) return null;
      const n = Abash.normPhone(user.phone);
      const hit = Abash.getMembers().find(
        (m) => m.propertyId === propertyId && Abash.normPhone(m.phone) === n
      );
      if (hit) return Abash.normRole(hit.role);
      const b = Abash.getBuilding(propertyId);
      if (b && Abash.normPhone(b.ownerPhone) === n) return "admin";
      if (b && b.createdBy === user.id) return "admin";
      return null;
    },
    highestTeamRole(user) {
      if (!user) return null;
      const mems = Abash.membershipsForPhone(user.phone);
      let best = null;
      mems.forEach((m) => {
        const r = Abash.normRole(m.role);
        if (Abash.roleRank(r) > Abash.roleRank(best)) best = r;
      });
      return best;
    },
    isStaffUser(user) {
      if (!user) return false;
      if (user.intent === "offer") return true;
      if (user.role === "owner" || user.role === "admin" || user.role === "editor" || user.role === "manager")
        return true;
      return Abash.membershipsForPhone(user.phone).length > 0;
    },
    canAddProperty(user) {
      if (!user) return false;
      if (user.intent === "offer" || user.role === "owner" || user.role === "admin") return true;
      return Abash.highestTeamRole(user) === "admin";
    },
    canPublishOn(user, propertyId) {
      if (!user || !propertyId) return false;
      const r = Abash.roleOnProperty(user, propertyId);
      if (r === "admin" || r === "editor") return true;
      return user.intent === "offer" || user.role === "owner" || user.role === "admin";
    },
    canEditProperty(user, propertyId) {
      return Abash.roleOnProperty(user, propertyId) === "admin";
    },
    canManageTeam(user, propertyId) {
      return Abash.roleOnProperty(user, propertyId) === "admin";
    },
    canInviteRole(actorRole, inviteRole) {
      return Abash.normRole(actorRole) === "admin" && Abash.normRole(inviteRole) === "editor";
    },
    canStatusListing(user, listing) {
      if (!user || !listing) return false;
      if (listing.ownerId === user.id) return true;
      const r = Abash.roleOnProperty(user, listing.buildingId);
      return r === "admin" || r === "editor";
    },
    canDeleteListing(user, listing) {
      if (!user || !listing) return false;
      if (listing.ownerId === user.id) return true;
      return Abash.roleOnProperty(user, listing.buildingId) === "admin";
    },
    accessibleProperties(user) {
      if (!user) return [];
      const ids = new Set(Abash.membershipsForPhone(user.phone).map((m) => m.propertyId));
      return Abash.getBuildings().filter((b) => {
        if (ids.has(b.id)) return true;
        if (Abash.normPhone(b.ownerPhone) === Abash.normPhone(user.phone)) return true;
        if (b.createdBy === user.id) return true;
        return false;
      });
    },
    propertiesForKind(kindId) {
      const kind = (window.ABASH_KINDS || []).find((k) => k.id === kindId);
      let list = Abash.getBuildings();
      if (!kind) return list;
      return list.filter((b) => kind.propertyTypes.includes(b.type));
    },
    filterPropertiesByQuery(list, q) {
      const query = String(q || "").trim().toLowerCase();
      if (!query) return list;
      return list.filter((b) => {
        const hay = [b.name, b.area, b.subArea, b.road, b.house, b.type].join(" ").toLowerCase();
        return hay.includes(query);
      });
    },
    ensureOwnerMember(building, user) {
      if (!building || !user) return;
      const list = Abash.getMembers();
      const n = Abash.normPhone(user.phone);
      const exists = list.some(
        (m) => m.propertyId === building.id && Abash.normPhone(m.phone) === n
      );
      if (exists) return;
      list.unshift({
        id: "m" + Date.now(),
        propertyId: building.id,
        phone: user.phone,
        name: user.name || "Admin",
        role: "admin"
      });
      Abash.setMembers(list);
    },
    inviteMember(propertyId, { phone, name, role }) {
      const n = Abash.normPhone(phone);
      if (!n || n.length < 10) return { ok: false, error: "phone" };
      const r = Abash.normRole(role) || "editor";
      if (r !== "editor") return { ok: false, error: "role" };
      const list = Abash.getMembers();
      const dup = list.find(
        (m) => m.propertyId === propertyId && Abash.normPhone(m.phone) === n
      );
      if (dup) {
        dup.role = "editor";
        dup.name = name || dup.name;
        Abash.setMembers(list);
        return { ok: true, member: dup, updated: true };
      }
      const member = {
        id: "m" + Date.now(),
        propertyId,
        phone: String(phone).trim(),
        name: name || "Editor",
        role: "editor"
      };
      list.unshift(member);
      Abash.setMembers(list);
      return { ok: true, member };
    },
    removeMember(memberId) {
      Abash.setMembers(Abash.getMembers().filter((m) => m.id !== memberId));
    },

    getListingPatches() {
      return read(KEYS.listingPatches, {});
    },
    patchListing(id, patch) {
      const all = Abash.getListingPatches();
      all[id] = { ...(all[id] || {}), ...patch };
      write(KEYS.listingPatches, all);
      const extra = read(KEYS.listings, []);
      const i = extra.findIndex((x) => x.id === id);
      if (i >= 0) {
        extra[i] = { ...extra[i], ...patch };
        write(KEYS.listings, extra);
      }
    },

    contactOptionsForProperty(propertyId, user) {
      const members = Abash.membersForProperty(propertyId);
      const opts = members.map((m) => ({
        phone: m.phone,
        name: m.name,
        role: m.role,
        label: m.name + " · " + m.role
      }));
      if (user && !opts.some((o) => Abash.normPhone(o.phone) === Abash.normPhone(user.phone))) {
        opts.unshift({
          phone: user.phone,
          name: user.name || "You",
          role: Abash.roleOnProperty(user, propertyId) || "owner",
          label: (user.name || "You") + " · you"
        });
      }
      return opts;
    },

    contactPickerHTML(propertyId, user) {
      const t = Abash.t;
      return (
        '<div class="form-row"><label class="field-label">' +
        t("publicContact") +
        '</label><input class="input" id="lp-phone" type="tel" value="' +
        (user.phone || "") +
        '"><p class="form-hint">' +
        t("publicContactHint") +
        "</p></div>"
      );
    },

    propertyFormHTML(t, kind, editing) {
      const e = editing || {};
      const types = kind ? kind.propertyTypes : ["Home"];
      return (
        '<div id="add-building-box" style="margin-bottom:18px;padding:16px;border:1px dashed var(--line)">' +
        (e.id
          ? '<div class="kicker" style="margin-bottom:10px">' + t("editProperty") + "</div>"
          : "") +
        '<div class="form-row"><label class="field-label">' +
        t("building") +
        ' type</label><select class="select" id="nb-type">' +
        types
          .map(
            (pt) =>
              "<option" + (e.type === pt ? " selected" : "") + ">" + pt + "</option>"
          )
          .join("") +
        '</select></div>' +
        '<div class="form-row"><label class="field-label">Name</label><input class="input" id="nb-name" placeholder="e.g. House 12 / Hostel / Guest house" value="' +
        (e.name || "").replace(/"/g, "&quot;") +
        '"></div>' +
        '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div><label class="field-label">' +
        t("area") +
        '</label><input class="input" id="nb-area" value="' +
        (e.area || "").replace(/"/g, "&quot;") +
        '"></div><div><label class="field-label">Sub-area</label><input class="input" id="nb-sub" value="' +
        (e.subArea || "").replace(/"/g, "&quot;") +
        '"></div></div>' +
        '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px"><div><label class="field-label">' +
        t("road") +
        '</label><input class="input" id="nb-road" value="' +
        (e.road || "").replace(/"/g, "&quot;") +
        '"></div><div><label class="field-label">' +
        t("block") +
        '</label><input class="input" id="nb-block" value="' +
        (e.block || "").replace(/"/g, "&quot;") +
        '"></div><div><label class="field-label">' +
        t("house") +
        '</label><input class="input" id="nb-house" value="' +
        (e.house || "").replace(/"/g, "&quot;") +
        '"></div></div>' +
        '<div class="form-row"><label class="field-label">' +
        t("locationHint") +
        '</label><input class="input" id="nb-note" value="' +
        (e.locationNote || "").replace(/"/g, "&quot;") +
        '"></div>' +
        '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
        '<div><label class="field-label">Lat</label><input class="input" id="nb-lat" placeholder="23.78" value="' +
        (e.lat || "") +
        '"></div>' +
        '<div><label class="field-label">Lng</label><input class="input" id="nb-lng" placeholder="90.41" value="' +
        (e.lng || "") +
        '"></div></div>' +
        '<p class="form-hint">' +
        t("mapHint") +
        "</p>" +
        (kind && (kind.id === "Hostel" || kind.id === "PG")
          ? '<div class="form-row"><label class="field-label">Gender</label><select class="select" id="nb-gender">' +
            ["Female", "Male", "Any"]
              .map(
                (g) =>
                  "<option" + (e.gender === g ? " selected" : "") + ">" + g + "</option>"
              )
              .join("") +
            "</select></div>"
          : "") +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button type="button" class="btn btn-outline btn-sm" data-action="save-building"' +
        (e.id ? ' data-edit-id="' + e.id + '"' : "") +
        ">" +
        t("saveProperty") +
        "</button>" +
        (e.id
          ? '<button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-property" style="border:0">' +
            t("back") +
            "</button>"
          : "") +
        "</div></div>"
      );
    },

    getSearch() {
      const saved = read(KEYS.search, null);
      if (!saved) return Abash.searchDefaults("Home");
      return { ...Abash.searchDefaults(saved.category || "Home"), ...saved };
    },
    setSearch(partial) {
      write(KEYS.search, { ...Abash.getSearch(), ...partial });
    },

    searchDefaults(category) {
      const cat = category || "Home";
      const base = {
        category: cat,
        area: "Mirpur",
        subArea: "",
        sort: "newest",
        beds: "Any",
        livingFor: "Any",
        furnished: "Any",
        gender: "Any",
        stayType: "Any",
        bath: "Any",
        sqft: "Any",
        budget: "any"
      };
      const kind = Abash.criteriaKind(cat);
      if (kind === "home") {
        base.budget = "10-20";
        base.beds = "2";
      } else if (kind === "room") {
        base.budget = "under10";
      } else if (kind === "seats") {
        base.budget = "under10";
      } else if (kind === "office") {
        base.budget = "30-50";
        base.area = "Gulshan";
      } else if (kind === "night") {
        base.budget = "2-4";
        base.area = "Dhanmondi";
      }
      return base;
    },

    criteriaKind(category) {
      if (category === "All") return "all";
      if (category === "Office") return "office";
      if (category === "Hostel" || category === "PG") return "seats";
      if (category === "Room") return "room";
      if (category === "Short Stay" || category === "Residential Hotel") return "night";
      return "home";
    },

    budgetOptions(kind, t) {
      if (kind === "office") {
        return [
          ["any", t("any")],
          ["under30", t("oUnder30")],
          ["30-50", t("o30_50")],
          ["50-80", t("o50_80")],
          ["80+", t("o80")]
        ];
      }
      if (kind === "night") {
        return [
          ["any", t("any")],
          ["under2", t("nUnder2")],
          ["2-4", t("n2_4")],
          ["4-6", t("n4_6")],
          ["6+", t("n6")]
        ];
      }
      return [
        ["any", t("any")],
        ["under10", t("under10")],
        ["10-20", t("b10_20")],
        ["20-30", t("b20_30")],
        ["30+", t("b30")]
      ];
    },

    budgetRange(key) {
      switch (key) {
        case "any":
        case "":
        case undefined:
          return [0, Infinity];
        case "under10":
          return [0, 9999];
        case "10-20":
          return [10000, 20000];
        case "20-30":
          return [20000, 30000];
        case "30+":
          return [30000, Infinity];
        case "under30":
          return [0, 29999];
        case "30-50":
          return [30000, 50000];
        case "50-80":
          return [50000, 80000];
        case "80+":
          return [80000, Infinity];
        case "under2":
          return [0, 1999];
        case "2-4":
          return [2000, 4000];
        case "4-6":
          return [4000, 6000];
        case "6+":
          return [6000, Infinity];
        default:
          return [0, Infinity];
      }
    },

    filterListings(params) {
      const p = { ...Abash.getSearch(), ...params };
      const kind = Abash.criteriaKind(p.category);
      const [min, max] = Abash.budgetRange(p.budget);
      let list = Abash.getAllListings().filter((l) => {
        if (p.category && p.category !== "All" && l.category !== p.category) return false;
        if (l.status === "rented" || l.status === "removed") return false;
        if (p.area && l.area !== p.area) return false;
        if (p.subArea && l.subArea !== p.subArea) return false;

        const isNight = l.priceUnit === "night";
        if (kind === "night" && !isNight) return false;
        if ((kind === "home" || kind === "room" || kind === "seats" || kind === "office") && isNight)
          return false;
        if (p.budget && p.budget !== "any" && (l.price < min || l.price > max)) return false;

        if (kind === "home") {
          if (p.beds && p.beds !== "Any") {
            if (p.beds === "4+") {
              if ((l.beds || 0) < 4) return false;
            } else if ((l.beds || 0) !== Number(p.beds)) return false;
          }
          if (p.livingFor && p.livingFor !== "Any" && l.livingFor && l.livingFor !== p.livingFor)
            return false;
          if (p.furnished && p.furnished !== "Any" && l.furnished && l.furnished !== p.furnished)
            return false;
        }

        if (kind === "room" && p.bath && p.bath !== "Any") {
          const attached = !!l.attachedBath;
          if (p.bath === "Attached" && !attached) return false;
          if (p.bath === "Shared" && attached) return false;
        }
        if (kind === "room") {
          if (p.furnished && p.furnished !== "Any" && l.furnished && l.furnished !== p.furnished)
            return false;
        }
        if (
          (kind === "room" || kind === "seats" || kind === "night") &&
          p.stayType &&
          p.stayType !== "Any"
        ) {
          const st = l.stayType || (String(l.roomType || "").toLowerCase().includes("single") ? "Single" : l.roomType ? "Shared" : "");
          if (st && st !== p.stayType) return false;
        }

        if (kind === "seats" && p.gender && p.gender !== "Any") {
          const g =
            l.gender || (l.buildingId && (Abash.getBuilding(l.buildingId) || {}).gender);
          if (g && g !== "Any" && g !== p.gender) return false;
        }

        if (kind === "office" && p.sqft && p.sqft !== "Any") {
          const need = Number(String(p.sqft).replace("+", "")) || 0;
          if ((l.sqft || 0) < need) return false;
        }

        return true;
      });
      if (p.sort === "price-asc") list.sort((a, b) => a.price - b.price);
      else if (p.sort === "price-desc") list.sort((a, b) => b.price - a.price);
      else list.sort((a, b) => a.postedDays - b.postedDays);
      return list;
    },

    /** Criteria steps after Looking for (budget + kind-specific). */
    searchCriteriaHTML(state, opts) {
      const t = Abash.t;
      const o = opts || {};
      const setAttr = o.refine
        ? (key, val) =>
            'data-action="refine-set" data-key="' + key + '" data-val="' + val + '"'
        : (key, val) => 'data-set="' + key + '" data-val="' + val + '"';
      const kind = Abash.criteriaKind(state.category);
      const budgets = Abash.budgetOptions(kind === "all" ? "month" : kind, t);
      let step = o.startStep || 2;
      let html = "";

      const chipStep = (label, key, options, rowClass) => {
        const n = step++;
        html +=
          '<div class="step"><div class="step-label">' +
          (o.numbered !== false ? '<span class="step-num">' + n + "</span>" : "") +
          label +
          '</div><div class="' +
          (rowClass || "chip-row") +
          '">' +
          options
            .map(([id, lab]) => {
              const on = String(state[key] || "Any") === String(id);
              return (
                '<button type="button" class="' +
                (rowClass === "bed-row" ? "bed" : "chip") +
                (on ? " on" : "") +
                '" ' +
                setAttr(key, id) +
                ">" +
                lab +
                "</button>"
              );
            })
            .join("") +
          "</div></div>";
      };

      chipStep(t("budget"), "budget", budgets);

      if (kind === "home") {
        chipStep(
          t("bedrooms"),
          "beds",
          [
            ["Any", t("any")],
            ["1", "1"],
            ["2", "2"],
            ["3", "3"],
            ["4+", "4+"]
          ],
          "bed-row"
        );
        chipStep(t("livingFor"), "livingFor", [
          ["Any", t("any")],
          ["Family", t("family")],
          ["Bachelor", t("bachelor")]
        ]);
        chipStep(t("furnishLabel"), "furnished", [
          ["Any", t("any")],
          ["Furnished", t("furnished")],
          ["Semi", t("semiFurnished")],
          ["Unfurnished", t("unfurnished")]
        ]);
      } else if (kind === "room") {
        chipStep(t("stayType"), "stayType", [
          ["Any", t("any")],
          ["Single", t("staySingle")],
          ["Shared", t("stayShared")]
        ]);
        chipStep(t("bathFilter"), "bath", [
          ["Any", t("any")],
          ["Attached", t("attachedBath")],
          ["Shared", t("sharedBath")]
        ]);
        chipStep(t("furnishLabel"), "furnished", [
          ["Any", t("any")],
          ["Furnished", t("furnished")],
          ["Semi", t("semiFurnished")],
          ["Unfurnished", t("unfurnished")]
        ]);
      } else if (kind === "seats") {
        chipStep(t("stayType"), "stayType", [
          ["Any", t("any")],
          ["Single", t("staySingle")],
          ["Shared", t("stayShared")]
        ]);
        chipStep(t("genderFilter"), "gender", [
          ["Any", t("any")],
          ["Female", t("genderFemale")],
          ["Male", t("genderMale")]
        ]);
      } else if (kind === "office") {
        chipStep(t("sizeFilter"), "sqft", [
          ["Any", t("any")],
          ["500+", "500+"],
          ["800+", "800+"],
          ["1200+", "1200+"]
        ]);
      } else if (kind === "night") {
        chipStep(t("stayType"), "stayType", [
          ["Any", t("any")],
          ["Single", t("staySingle")],
          ["Shared", t("stayShared")]
        ]);
      }

      return { html, nextStep: step };
    },

    addRecentArea(label) {
      let recent = read(KEYS.recentAreas, []);
      recent = [label, ...recent.filter((x) => x !== label)].slice(0, 5);
      write(KEYS.recentAreas, recent);
    },
    getRecentAreas() {
      return read(KEYS.recentAreas, ["Mirpur", "Uttara Sector 10", "Dhanmondi 27"]);
    },

    formatPrice(n) {
      return "৳" + Number(n).toLocaleString("en-BD");
    },
    mediaClass(l) {
      return l.media || "m1";
    },

    listingPhotos(listing) {
      if (listing.photos && listing.photos.length) return listing.photos;
      const pool = window.ABASH_SAMPLE_PHOTOS || [];
      if (!pool.length) return [];
      let n = 0;
      const id = String(listing.id || "x");
      for (let i = 0; i < id.length; i++) n += id.charCodeAt(i);
      return [pool[n % pool.length], pool[(n + 3) % pool.length]];
    },

    listingCoords(listing) {
      if (listing.lat && listing.lng) return { lat: listing.lat, lng: listing.lng };
      const key = listing.subArea || listing.area;
      const c = (window.ABASH_AREA_COORDS || {})[key];
      if (c) return { lat: c[0], lng: c[1] };
      if (listing.buildingId) {
        const b = Abash.getBuilding(listing.buildingId);
        if (b && b.lat && b.lng) return { lat: b.lat, lng: b.lng };
      }
      return { lat: 23.7808, lng: 90.4072 };
    },

    mapsEmbedUrl(lat, lng) {
      return (
        "https://maps.google.com/maps?q=" +
        encodeURIComponent(lat + "," + lng) +
        "&z=16&output=embed"
      );
    },

    mapsOpenUrl(lat, lng, label) {
      return (
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(lat + "," + lng + (label ? " (" + label + ")" : ""))
      );
    },

    photoBlock(listing, extraClass) {
      const photos = Abash.listingPhotos(listing);
      const url = photos[0];
      if (url) {
        return (
          '<div class="photo' +
          (extraClass ? " " + extraClass : "") +
          '" style="background-image:url(\'' +
          url +
          "')\"></div>"
        );
      }
      return (
        '<div class="photo ' +
        Abash.mediaClass(listing) +
        (extraClass ? " " + extraClass : "") +
        '"></div>'
      );
    },

    photoPickerHTML(t, selected) {
      const pool = window.ABASH_SAMPLE_PHOTOS || [];
      const sel = selected || [];
      return (
        '<div class="form-row"><label class="field-label">' +
        t("photosLabel") +
        " · " +
        t("pickPhotos") +
        '</label><div class="photo-pick-row">' +
        pool
          .map((url, i) => {
            const on = sel.indexOf(url) >= 0;
            return (
              '<button type="button" class="photo-pick ' +
              (on ? "on" : "") +
              '" data-action="toggle-photo" data-url="' +
              url +
              '" style="background-image:url(\'' +
              url +
              "')\"></button>"
            );
          })
          .join("") +
        '</div><input type="hidden" id="lp-photos" value="' +
        sel.join("|") +
        '"></div>' +
        '<div class="form-row"><label class="field-label">' +
        t("videoLabel") +
        '</label><input class="input" id="lp-video" type="url" placeholder="https://youtube.com/watch?v=…"></div>'
      );
    },

    sendOtp(phone) {
      const code = "1234";
      otpMem = { phone, code };
      write(KEYS.otp, otpMem);
      return code;
    },
    verifyOtp(phone, code) {
      const pending = otpMem || read(KEYS.otp, null);
      if (!pending || pending.phone !== phone) return false;
      return String(code).trim() === String(pending.code);
    },

    toast(msg) {
      let el = $(".toast");
      if (!el) {
        el = document.createElement("div");
        el.className = "toast";
        document.body.appendChild(el);
      }
      el.textContent = msg;
      el.classList.add("show");
      clearTimeout(el._t);
      el._t = setTimeout(() => el.classList.remove("show"), 2400);
    },

    /* ——— Router ——— */
    parseHash() {
      const raw = (location.hash || "#/").replace(/^#\/?/, "");
      const [pathPart, queryPart] = raw.split("?");
      const parts = pathPart.split("/").filter(Boolean);
      const name = parts[0] || "home";
      const params = {};
      if (name === "listing" && parts[1]) params.id = decodeURIComponent(parts[1]);
      if (name === "profile" && parts[1]) params.id = decodeURIComponent(parts[1]);
      if (queryPart) {
        new URLSearchParams(queryPart).forEach((v, k) => {
          params[k] = v;
        });
      }
      return { name, params };
    },

    go(name, params) {
      params = params || {};
      let hash = "#/" + name;
      if (name === "home") hash = "#/";
      if (name === "listing" && params.id) hash = "#/listing/" + encodeURIComponent(params.id);
      if (name === "profile" && params.id) hash = "#/profile/" + encodeURIComponent(params.id);
      const q = new URLSearchParams();
      Object.keys(params).forEach((k) => {
        if (k === "id" && (name === "listing" || name === "profile")) return;
        if (params[k] !== undefined && params[k] !== "") q.set(k, params[k]);
      });
      const qs = q.toString();
      if (qs) hash += (hash.includes("?") ? "&" : "?") + qs;
      if (location.hash === hash) Abash.render();
      else location.hash = hash;
    },

    requireAuth(nextRoute) {
      if (Abash.getUser()) return true;
      Abash.go("login", { next: nextRoute || "home" });
      return false;
    },

    cardHTML(listing) {
      const lang = Abash.getLang();
      const title = lang === "bn" ? listing.titleBn || listing.title : listing.title;
      const unit = listing.priceUnit === "night" ? Abash.t("perNight") : Abash.t("perMonth");
      const saved = Abash.isSaved(listing.id);
      let meta = "";
      if (listing.category === "Office") meta = (listing.sqft || 0) + " sqft";
      else if (listing.category === "Hostel" || listing.category === "PG")
        meta = (listing.seatsFree || 1) + " seat" + ((listing.seatsFree || 1) > 1 ? "s" : "") + " free";
      else if (listing.category === "Room")
        meta =
          (listing.furnished ? listing.furnished + " · " : "") +
          (listing.attachedBath ? "Attached bath" : "Shared bath") +
          (listing.floor ? " · " + listing.floor : "");
      else if (listing.category === "Short Stay" || listing.category === "Residential Hotel")
        meta =
          (listing.stayType || "Single") +
          " · " +
          (listing.attachedBath ? "Attached bath" : "Shared bath") +
          " · " +
          (listing.kitchen || "Kitchen");
      else
        meta =
          (listing.livingFor ? listing.livingFor + " · " : "") +
          (listing.furnished ? listing.furnished + " · " : "") +
          listing.beds +
          " Bed · " +
          listing.baths +
          " Bath" +
          (listing.floor ? " · " + listing.floor : "");
      return (
        '<article class="card-wrap">' +
        '<a class="card" href="#/listing/' +
        encodeURIComponent(listing.id) +
        '">' +
        '<div class="card-media">' +
        Abash.photoBlock(listing) +
        '<div class="jali"></div>' +
        '<span class="card-tag">' +
        listing.category +
        " · " +
        (listing.subArea || listing.area) +
        "</span>" +
        '<button type="button" class="save-btn ' +
        (saved ? "on" : "") +
        '" data-save="' +
        listing.id +
        '">♡</button></div>' +
        '<div class="card-price">' +
        Abash.formatPrice(listing.price) +
        " <small>" +
        unit +
        "</small></div>" +
        '<div class="card-title">' +
        title +
        "</div>" +
        '<div class="card-meta">' +
        meta +
        "</div>" +
        '<div class="card-loc">' +
        (listing.subArea ? listing.subArea + ", " : "") +
        listing.area +
        ", Dhaka</div></a></article>"
      );
    },

    kindInfo(kindId) {
      return (window.ABASH_KINDS || []).find((k) => k.id === kindId) || null;
    },

    shell(content) {
      const user = Abash.getUser();
      const t = Abash.t;
      const staff = Abash.isStaffUser(user);
      return (
        '<div class="demo-banner"><span>Abash</span> · ' +
        t("demoBanner") +
        (window.ABASH_DEMO_TEAM_HINT ? " · " + t("teamDemoShort") : "") +
        "</div>" +
        '<nav class="nav"><div class="wrap nav-inner">' +
        '<a class="logo" href="#/">Abash<i>.</i></a>' +
        '<div class="nav-links">' +
        '<a href="#/">' +
        t("explore") +
        "</a>" +
        '<a href="#/list-place">' +
        t("listPlace") +
        "</a>" +
        '<a href="#/wishlist">' +
        t("wishlist") +
        "</a>" +
        (staff ? '<a href="#/dashboard">' + t("dashboard") + "</a>" : "") +
        "</div>" +
            '<div class="nav-actions">' +
        '<a class="nav-wish" href="#/wishlist" title="' +
        t("wishlist") +
        '"><span class="wish-ico">♡</span> ' +
        t("wishlist") +
        "</a>" +
        '<button type="button" data-action="lang">' +
        t("lang") +
        "</button>" +
        (user
          ? '<span class="nav-user hide-sm">' +
            (user.name || user.phone) +
            '</span><button type="button" class="btn-text" data-action="logout">' +
            t("signOut") +
            "</button>"
          : '<a class="btn-text" href="#/login">' + t("signIn") + "</a>") +
        "</div></div></nav>" +
        '<div id="view">' +
        content +
        "</div>" +
        '<footer class="footer"><div class="wrap footer-inner">' +
        "<div>© 2026 Abash · demo</div>" +
        '<div class="footer-links"><a href="#/">Home</a><a href="#/login">Login</a><a href="#/list-place">List</a><a href="#/wishlist">Saved</a></div>' +
        "</div></footer>"
      );
    },

    viewHome() {
      const t = Abash.t;
      const state = Abash.getSearch();
      const cats = ["Home", "Room", "Hostel", "PG", "Office", "Short Stay", "Residential Hotel"];
      const icons = {
        Home: '<path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z"/>',
        Room: '<rect x="5" y="7" width="14" height="12" rx="1"/><path d="M9 7V5.5A3 3 0 0 1 15 5.5V7"/>',
        Hostel:
          '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>',
        PG: '<circle cx="12" cy="8" r="3.2"/><path d="M6.2 19c.7-3.2 3-5 5.8-5s5.1 1.8 5.8 5"/>',
        Office: '<path d="M4 20V8l8-4 8 4v12"/><path d="M9 20v-6h6v6"/><path d="M4 12h16"/>',
        "Short Stay": '<path d="M4 20V10l8-5 8 5v10"/><path d="M9 20v-5h6v5"/>',
        "Residential Hotel":
          '<path d="M3 20V7l9-4 9 4v13"/><path d="M8 20v-6h8v6"/><path d="M8 10h.01M12 10h.01M16 10h.01"/>'
      };
      const criteria = Abash.searchCriteriaHTML(state, { startStep: 2, numbered: true });
      const count = Abash.filterListings(state).length;
      const areaLabel = state.subArea
        ? state.subArea + ", " + state.area
        : (state.area || "Mirpur") + ", Dhaka";
      const areaStep = criteria.nextStep;
      const lang = Abash.getLang();
      const reviews = window.ABASH_REVIEWS || [];
      const voiceCard = (r, hidden) =>
        '<article class="voice tone-' +
        (r.tone || "cream") +
        '"' +
        (hidden ? ' aria-hidden="true"' : "") +
        '><div class="voice-stars">★★★★★</div><p class="voice-quote">' +
        (lang === "bn" ? r.quoteBn || r.quote : r.quote) +
        '</p><div class="voice-meta"><span class="voice-mark">' +
        (r.mark || (r.name || "?").charAt(0)) +
        "</span><div><strong>" +
        (lang === "bn" ? r.nameBn || r.name : r.name) +
        "</strong><span>" +
        (lang === "bn" ? r.roleBn || r.role : r.role) +
        "</span></div></div></article>";
      const riverA = reviews.slice(0, 6);
      const riverB = reviews.slice(6).concat(reviews.slice(0, 2));
      const pulseOnce =
        '<span class="pulse-item"><i class="pulse-dot"></i><strong>240+</strong> ' +
        t("pulseActive") +
        '</span><span class="pulse-sep">·</span>' +
        '<span class="pulse-item">' +
        t("pulseMirpur") +
        '</span><span class="pulse-sep">·</span>' +
        '<span class="pulse-item">' +
        t("pulseDhan") +
        '</span><span class="pulse-sep">·</span>' +
        '<span class="pulse-item">' +
        t("pulseBroker") +
        '</span><span class="pulse-sep">·</span>' +
        '<span class="pulse-item">' +
        t("pulseUttara") +
        '</span><span class="pulse-sep">·</span>' +
        '<span class="pulse-item"><strong>18</strong> ' +
        t("pulseBanani") +
        '</span><span class="pulse-sep">·</span>';

      return (
        '<main class="home-v2">' +
        '<section class="hero"><div class="hero-bg" aria-hidden="true"></div>' +
        '<div class="wrap hero-content">' +
        '<div class="hero-brand">Abash<i>.</i></div>' +
        '<h1 class="hero-title">' +
        t("heroTitle") +
        "</h1>" +
        '<p class="hero-sub">' +
        t("heroSub") +
        "</p>" +
        '<p class="how-chat" aria-label="' +
        t("quickPath") +
        '"><span class="how-chat-label">' +
        t("quickPath") +
        '</span><span class="how-pill">' +
        t("howSearch") +
        '</span><span class="how-arrow" aria-hidden="true">→</span><span class="how-pill">' +
        t("howFilter") +
        '</span><span class="how-arrow" aria-hidden="true">→</span><span class="how-pill">' +
        t("howCall") +
        "</span></p>" +
        '<a class="hero-cta" href="#/" data-action="scroll-search">' +
        t("searchCta") +
        " <span>↓</span></a>" +
        "</div></section>" +
        '<section class="pulse" aria-label="Live activity"><div class="pulse-track">' +
        pulseOnce +
        pulseOnce +
        "</div></section>" +
        '<section class="search-section" id="search"><div class="wrap">' +
        '<div class="panel search-panel panel-pad" id="home-search">' +
        '<div class="step"><div class="step-label"><span class="step-num">1</span>' +
        t("lookingFor") +
        '</div><p class="cat-scroll-hint">' +
        t("scrollCats") +
        '</p><div class="cat-row">' +
        cats
          .map(
            (c) =>
              '<button type="button" class="cat ' +
              (state.category === c ? "on" : "") +
              '" data-set="category" data-val="' +
              c +
              '"><div class="cat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6">' +
              (icons[c] || icons.Home) +
              '</svg></div><div class="cat-name">' +
              c +
              "</div></button>"
          )
          .join("") +
        "</div></div>" +
        criteria.html +
        '<div class="step"><div class="step-label"><span class="step-num">' +
        areaStep +
        "</span>" +
        t("area") +
        '</div><button type="button" class="area-field" data-action="pick-area"><div><div class="area-field-text">' +
        areaLabel +
        '</div><div class="area-field-sub">' +
        t("tapArea") +
        '</div></div><div class="area-field-arrow">›</div></button></div>' +
        '<button type="button" class="btn btn-primary btn-block btn-search-home" data-action="search">' +
        t("searchPlaces") +
        " → " +
        count +
        "</button></div></div></section>" +
        '<div class="wrap why-teaser-wrap"><a class="why-teaser" href="#/why">' +
        '<span class="why-teaser-kicker">' +
        t("whyKicker") +
        '</span><span class="why-chips">' +
        '<span class="why-chip wine">' +
        t("whyBroker") +
        '</span><span class="why-chip gold">' +
        t("whyDirect") +
        '</span><span class="why-chip ink">' +
        t("whyCalm") +
        '</span></span><span class="why-teaser-more">' +
        t("whyMore") +
        " <span>→</span></span></a></div>" +
        '<section class="offer-band"><div class="wrap offer-band-inner">' +
        '<div class="offer-band-copy"><div class="kicker">' +
        t("offerBandKicker") +
        "</div><h2>" +
        t("offerBandTitle") +
        "</h2><p>" +
        t("offerBandSub") +
        '</p></div><a class="offer-cta" href="#/list-place">' +
        t("listPlace") +
        " <span>→</span></a></div></section>" +
        '<section class="voices" aria-label="Reviews">' +
        '<div class="wrap voices-head"><div class="kicker">' +
        t("reviewsKicker") +
        '</div><h2 class="h2">' +
        t("reviewsTitle") +
        "</h2><p>" +
        t("reviewsHint") +
        "</p></div>" +
        '<div class="voices-river"><div class="voices-track">' +
        riverA.map((r) => voiceCard(r, false)).join("") +
        riverA.map((r) => voiceCard(r, true)).join("") +
        '</div></div><div class="voices-river"><div class="voices-track voices-track-rev">' +
        riverB.map((r) => voiceCard(r, false)).join("") +
        riverB.map((r) => voiceCard(r, true)).join("") +
        "</div></div></section></main>"
      );
    },

    viewWhy() {
      const t = Abash.t;
      return (
        '<main class="wrap-sm" style="padding:64px 0 80px;text-align:center">' +
        '<div class="kicker">' +
        t("whyKicker") +
        "</div>" +
        '<h1 class="h2" style="margin-bottom:14px">' +
        t("whyPageTitle") +
        "</h1>" +
        '<p class="soft" style="margin-bottom:28px">' +
        t("whyPageBody") +
        '</p><a class="btn-text" href="#/">' +
        t("whyPageBack") +
        "</a></main>"
      );
    },

    viewArea(params) {
      const t = Abash.t;
      const q = (params.q || "").toLowerCase();
      const from = params.from || "home";
      let listHtml = (window.ABASH_AREAS || [])
        .map((a, i) => {
          const subs = a.subs.filter(
            (s) => !q || s.name.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
          );
          if (q && !a.name.toLowerCase().includes(q) && !subs.length) return "";
          const open = q || i === 0 ? "open" : "";
          return (
            '<button type="button" class="ap-row ' +
            open +
            '" data-action="toggle-area">' +
            '<div style="display:flex;align-items:center"><span class="ap-name">' +
            a.name +
            '</span><span class="ap-count">' +
            a.count +
            '</span></div><span class="ap-chevron">›</span></button>' +
            '<div class="ap-subs">' +
            '<button type="button" class="ap-sub" data-action="choose-area" data-area="' +
            a.name +
            '" data-sub="" data-from="' +
            from +
            '">All ' +
            a.name +
            "</button>" +
            (q ? subs : a.subs)
              .map(
                (s) =>
                  '<button type="button" class="ap-sub" data-action="choose-area" data-area="' +
                  a.name +
                  '" data-sub="' +
                  s.name +
                  '" data-from="' +
                  from +
                  '"><span>' +
                  s.name +
                  '</span><span class="ap-count">' +
                  s.count +
                  "</span></button>"
              )
              .join("") +
            "</div>"
          );
        })
        .join("");

      return (
        '<main class="wrap-md" style="padding-bottom:64px"><div class="page-head">' +
        '<a class="back" href="#/" style="display:inline-flex;font-size:12px;font-weight:700;color:var(--soft);margin-bottom:14px">← Back</a>' +
        '<h1 class="h2">' +
        t("selectArea") +
        "</h1></div>" +
        '<div class="ap-search"><input type="search" id="area-q" placeholder="' +
        t("searchArea") +
        '" value="' +
        (params.q || "") +
        '"><span style="color:var(--wine)">⌕</span></div>' +
        '<div class="ap-label">' +
        t("recent") +
        '</div><div class="quick-row">' +
        Abash.getRecentAreas()
          .map(
            (r) =>
              '<button type="button" class="quick" data-action="recent-area" data-label="' +
              r +
              '" data-from="' +
              from +
              '">' +
              r +
              "</button>"
          )
          .join("") +
        '</div><div class="ap-label">' +
        t("dhakaAreas") +
        '</div><div id="area-list">' +
        (listHtml || '<div class="empty"><p>' + t("emptySub") + "</p></div>") +
        "</div></main>"
      );
    },

    viewResults(params) {
      const t = Abash.t;
      const saved = Abash.getSearch();
      const p = {
        ...saved,
        category: params.category || saved.category || "Home",
        budget: params.budget || saved.budget || "any",
        beds: params.beds || saved.beds || "Any",
        livingFor: params.livingFor || saved.livingFor || "Any",
        furnished: params.furnished || saved.furnished || "Any",
        gender: params.gender || saved.gender || "Any",
        stayType: params.stayType || saved.stayType || "Any",
        bath: params.bath || saved.bath || "Any",
        sqft: params.sqft || saved.sqft || "Any",
        area: params.area || saved.area || "Mirpur",
        subArea: params.subArea != null ? params.subArea : saved.subArea || "",
        sort: params.sort || saved.sort || "newest"
      };
      Abash.setSearch(p);
      const list = Abash.filterListings(p);
      const cats = ["All", "Home", "Room", "Hostel", "PG", "Office", "Short Stay", "Residential Hotel"];
      const criteria = Abash.searchCriteriaHTML(p, { startStep: 2, numbered: false, refine: true });
      const areaLabel = p.subArea ? p.subArea + ", " + p.area : p.area + ", Dhaka";

      return (
        '<main class="wrap" style="padding-bottom:64px"><div class="results-head"><div>' +
        '<a class="back" href="#/" style="display:inline-flex;font-size:12px;font-weight:700;color:var(--soft);margin-bottom:10px">← Home</a>' +
        '<h1 class="h2">' +
        (p.subArea || p.area) +
        '<span style="color:var(--wine)">.</span></h1>' +
        '<div class="results-meta">' +
        list.length +
        " " +
        t("placesFound") +
        " · " +
        areaLabel +
        '</div></div><div class="refine-bar">' +
        '<button type="button" class="refine-toggle ' +
        (refineOpen ? "open" : "") +
        '" data-action="toggle-refine">' +
        t("refine") +
        (refineOpen ? " ✕" : " ▾") +
        "</button>" +
        '<select class="sort-select" data-action="results-sort">' +
        '<option value="newest"' +
        (p.sort === "newest" ? " selected" : "") +
        ">" +
        t("sortNewest") +
        "</option>" +
        '<option value="price-asc"' +
        (p.sort === "price-asc" ? " selected" : "") +
        ">" +
        t("sortPriceAsc") +
        "</option>" +
        '<option value="price-desc"' +
        (p.sort === "price-desc" ? " selected" : "") +
        ">" +
        t("sortPriceDesc") +
        "</option></select></div></div>" +
        '<div class="refine-panel ' +
        (refineOpen ? "open" : "") +
        '" id="refine-panel">' +
        '<div class="step" style="padding-top:0"><div class="step-label">' +
        t("lookingFor") +
        '</div><div class="chip-row">' +
        cats
          .map(
            (c) =>
              '<button type="button" class="chip ' +
              (p.category === c ? "on" : "") +
              '" data-action="refine-set" data-key="category" data-val="' +
              c +
              '">' +
              c +
              "</button>"
          )
          .join("") +
        "</div></div>" +
        criteria.html +
        '<div class="step"><div class="step-label">' +
        t("area") +
        '</div><button type="button" class="area-field" data-action="pick-area-results" style="width:100%"><div><div class="area-field-text">' +
        areaLabel +
        '</div><div class="area-field-sub">' +
        t("tapArea") +
        '</div></div><div class="area-field-arrow">›</div></button></div>' +
        '<div class="refine-actions"><button type="button" class="btn btn-primary btn-sm" data-action="toggle-refine">' +
        t("refineApply") +
        " · " +
        list.length +
        "</button></div></div>" +
        '<div class="toolbar" style="border-top:0;margin-top:0"><div class="tabs">' +
        cats
          .slice(0, 5)
          .map(
            (c) =>
              '<button type="button" class="tab ' +
              (p.category === c ? "on" : "") +
              '" data-action="results-cat" data-val="' +
              c +
              '">' +
              c +
              "</button>"
          )
          .join("") +
        "</div></div>" +
        (list.length
          ? '<div class="grid">' + list.map(Abash.cardHTML).join("") + "</div>"
          : '<div class="empty"><h3 class="h3">' +
            t("emptyTitle") +
            "</h3><p>" +
            t("emptySub") +
            '</p><button type="button" class="btn btn-primary" data-action="toggle-refine">' +
            t("refine") +
            "</button></div>") +
        "</main>"
      );
    },

    viewListing(params) {
      const t = Abash.t;
      const listing = Abash.getListing(params.id);
      if (!listing) {
        return (
          '<main class="wrap"><div class="empty" style="margin:48px 0"><h3 class="h3">Listing not found</h3>' +
          '<a class="btn btn-primary" href="#/">Home</a></div></main>'
        );
      }
      const lang = Abash.getLang();
      const title = lang === "bn" ? listing.titleBn || listing.title : listing.title;
      const desc = lang === "bn" ? listing.descriptionBn || listing.description : listing.description;
      const owner = lang === "bn" ? listing.ownerBn || listing.owner : listing.owner;
      const unit = listing.priceUnit === "night" ? t("perNight") : t("perMonth");
      const saved = Abash.isSaved(listing.id);
      const posted = listing.postedDays === 0 ? "Today" : listing.postedDays + "d ago";
      const coords = Abash.listingCoords(listing);
      const photos = Abash.listingPhotos(listing);
      const tel = listing.phone.replace(/[^0-9+]/g, "");

      return (
        "<main><div class=\"detail-hero\">" +
        Abash.photoBlock(listing) +
        '<div class="jali"></div>' +
        '<div class="detail-actions"><a class="circle" href="#/results">←</a>' +
        '<button type="button" class="circle save-btn ' +
        (saved ? "on" : "") +
        '" data-save="' +
        listing.id +
        '" style="position:static;width:40px;height:40px">♡</button></div></div>' +
        (photos.length > 1
          ? '<div class="wrap photo-strip">' +
            photos
              .map(
                (u) =>
                  '<div class="photo-strip-item" style="background-image:url(\'' + u + "')\"></div>"
              )
              .join("") +
            "</div>"
          : "") +
        '<div class="wrap detail-body"><div class="kicker">' +
        listing.category +
        " · " +
        (listing.subArea || listing.area) +
        (listing.livingFor ? " · " + listing.livingFor : "") +
        (listing.furnished ? " · " + listing.furnished : "") +
        (listing.stayType ? " · " + listing.stayType : "") +
        '</div><div class="detail-top"><div style="max-width:640px"><h1 class="h2">' +
        title +
        '</h1><p class="soft" style="margin-top:6px;font-size:14px">' +
        (listing.subArea ? listing.subArea + ", " : "") +
        listing.area +
        ", Dhaka — direct from owner</p></div>" +
        '<div class="detail-price">' +
        Abash.formatPrice(listing.price) +
        "<small>" +
        unit +
        "</small></div></div>" +
        '<div class="dims">' +
        (listing.category === "Hostel" || listing.category === "PG"
          ? '<div class="dim"><div class="dim-num">' +
            (listing.seatsFree || 1) +
            '</div><div class="dim-lbl">Seats</div></div>' +
            '<div class="dim"><div class="dim-num">' +
            (listing.roomType || "Seat") +
            '</div><div class="dim-lbl">Type</div></div>' +
            '<div class="dim"><div class="dim-num">' +
            Abash.formatPrice(listing.price) +
            '</div><div class="dim-lbl">/ mo</div></div>'
          : listing.category === "Office"
            ? '<div class="dim"><div class="dim-num">' +
              (listing.sqft || "—") +
              '</div><div class="dim-lbl">Sqft</div></div>' +
              '<div class="dim"><div class="dim-num">' +
              (listing.floor || "—") +
              '</div><div class="dim-lbl">' +
              t("floor") +
              "</div></div>" +
              '<div class="dim"><div class="dim-num">' +
              (listing.parking || "—") +
              '</div><div class="dim-lbl">Parking</div></div>'
            : listing.category === "Short Stay" || listing.category === "Residential Hotel"
              ? '<div class="dim"><div class="dim-num">' +
                (listing.stayType || "Single") +
                '</div><div class="dim-lbl">' +
                t("stayType") +
                "</div></div>" +
                '<div class="dim"><div class="dim-num">' +
                (listing.attachedBath ? "Attached" : "Shared") +
                '</div><div class="dim-lbl">Bath</div></div>' +
                '<div class="dim"><div class="dim-num">' +
                (listing.kitchen || "—") +
                '</div><div class="dim-lbl">' +
                t("kitchen") +
                "</div></div>" +
                '<div class="dim"><div class="dim-num">' +
                (listing.beds || 1) +
                '</div><div class="dim-lbl">Bed</div></div>'
              : '<div class="dim"><div class="dim-num">' +
                (listing.beds || "—") +
                '</div><div class="dim-lbl">Bed</div></div>' +
                '<div class="dim"><div class="dim-num">' +
                (listing.baths || "—") +
                '</div><div class="dim-lbl">Bath</div></div>' +
                '<div class="dim"><div class="dim-num">' +
                (listing.floor || "—") +
                '</div><div class="dim-lbl">' +
                t("floor") +
                "</div></div>" +
                (listing.category === "Home"
                  ? '<div class="dim"><div class="dim-num">' +
                    (listing.balcony != null ? listing.balcony : "—") +
                    '</div><div class="dim-lbl">' +
                    t("balcony") +
                    "</div></div>"
                  : "") +
                '<div class="dim"><div class="dim-num">' +
                (listing.sqft || "—") +
                '</div><div class="dim-lbl">Sqft</div></div>') +
        "</div>" +
        '<div class="kicker">' +
        t("location") +
        '</div><div class="loc-block">' +
        '<div class="loc-line"><b>' +
        (listing.subArea || listing.area) +
        ", " +
        listing.area +
        "</b></div>" +
        (listing.road || listing.block || listing.house
          ? '<div class="loc-line">' +
            [listing.road, listing.block, listing.house].filter(Boolean).join(" · ") +
            "</div>"
          : "") +
        (listing.locationNote
          ? '<div class="loc-line" style="margin-top:6px;font-style:italic">' +
            listing.locationNote +
            "</div>"
          : "") +
        '</div><div class="map-wrap">' +
        '<iframe class="map-frame" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="' +
        Abash.mapsEmbedUrl(coords.lat, coords.lng) +
        '"></iframe>' +
        '<a class="btn-ghost" style="display:inline-block;margin-top:10px" href="' +
        Abash.mapsOpenUrl(coords.lat, coords.lng, title) +
        '" target="_blank" rel="noopener">' +
        t("openMaps") +
        " →</a></div>" +
        (listing.videoUrl
          ? '<div class="kicker" style="margin-top:28px">' +
            t("videoLabel") +
            '</div><p class="soft" style="font-size:13px;margin-bottom:10px"><a class="wine" href="' +
            listing.videoUrl +
            '" target="_blank" rel="noopener">' +
            listing.videoUrl +
            "</a></p>"
          : "") +
        '<div class="kicker">' +
        t("thePlace") +
        '</div><p class="serif" style="font-style:italic;font-size:16px;line-height:1.75;color:var(--soft);max-width:640px">' +
        desc +
        "</p>" +
        '<div class="kicker" style="margin-top:28px">' +
        t("amenities") +
        "</div>" +
        (listing.amenities || [])
          .map(
            (a) =>
              '<div class="amenity-row"><span>' + a + "</span><span>Available</span></div>"
          )
          .join("") +
        '<div class="kicker" style="margin-top:28px">' +
        t("contactPerson") +
        '</div><div class="owner-box"><div class="owner-avatar"></div><div>' +
        '<div class="owner-name"><a class="wine" href="#/profile/' +
        encodeURIComponent(Abash.normPhone(listing.phone) || listing.ownerId || "x") +
        '">' +
        (listing.contactName || owner) +
        "</a></div><div class=\"owner-role\">Posted " +
        posted +
        " · " +
        t("availableUntil") +
        " " +
        listing.availableUntil +
        "</div></div></div>" +
        '<div class="phone-box"><div><div class="field-label">' +
        t("publicPhone") +
        '</div><div class="phone-num">' +
        listing.phone +
        '</div></div><a class="btn btn-wine" href="tel:' +
        tel +
        '">' +
        t("callOwner") +
        "</a></div>" +
        '<button type="button" class="report-link" data-action="report">' +
        t("report") +
        "</button></div>" +
        '<div class="sticky-cta"><div class="wrap sticky-inner">' +
        '<button type="button" class="btn btn-outline" data-action="no-chat" style="flex:0">✉</button>' +
        '<a class="btn btn-wine btn-block" href="tel:' +
        tel +
        '">' +
        t("callOwner") +
        "</a></div></div></main>"
      );
    },

    viewAuth(mode, params) {
      const t = Abash.t;
      const isSignup = mode === "signup";
      return (
        '<main class="auth-page"><div class="wrap-sm panel auth-card" id="auth-card" data-mode="' +
        mode +
        '" data-next="' +
        (params.next || "") +
        '">' +
        '<h1 class="h2">' +
        (isSignup ? t("signupTitle") : t("loginTitle")) +
        "</h1>" +
        '<p class="form-hint" style="margin-bottom:12px">' +
        (isSignup ? t("authHintSignup") : t("authHintLogin")) +
        "</p>" +
        '<p class="form-hint" style="margin-bottom:16px">' +
        (window.ABASH_DEMO_TEAM_HINT || "") +
        "</p>" +
        '<div class="role-toggle">' +
        '<button type="button" class="on" data-action="role" data-role="renter">' +
        t("asRenter") +
        "</button>" +
        '<button type="button" data-action="role" data-role="owner">' +
        t("asOwner") +
        "</button></div>" +
        '<div class="form-row"><label class="field-label">' +
        t("name") +
        '</label><input class="input" id="auth-name" type="text" placeholder="Your name" ' +
        (isSignup ? "" : 'style="display:none"') +
        "></div>" +
        '<div class="form-row"><label class="field-label">' +
        t("phone") +
        '</label><input class="input" id="auth-phone" type="tel" placeholder="01XXXXXXXXX" value="' +
        (isSignup ? "" : "01700000001") +
        '"></div>' +
        '<div class="form-row"><label class="field-label">' +
        t("password") +
        '</label><input class="input" id="auth-pass" type="password" placeholder="' +
        (isSignup ? "min 6 chars" : "abash123") +
        '" value="' +
        (isSignup ? "" : "abash123") +
        '"></div>' +
        (isSignup
          ? '<div class="form-row"><label class="field-label">' +
            t("passwordConfirm") +
            '</label><input class="input" id="auth-pass2" type="password"></div>' +
            '<div class="form-row" id="otp-wrap" style="display:none"><label class="field-label">' +
            t("otp") +
            '</label><input class="input" id="auth-otp" type="text" inputmode="numeric" maxlength="4" placeholder="1234">' +
            '<div class="form-hint">Demo OTP: 1234</div></div>'
          : "") +
        '<button type="button" class="btn btn-primary btn-block" data-action="auth-submit" id="auth-btn">' +
        (isSignup ? t("sendOtp") : t("signInBtn")) +
        "</button>" +
        '<div class="auth-footer">' +
        (isSignup
          ? t("hasAccount") + ' <a href="#/login">' + t("signIn") + "</a>"
          : t("noAccount") + ' <a href="#/signup">' + t("createAccount") + "</a>") +
        "</div></div></main>"
      );
    },

    viewWishlist() {
      if (!Abash.requireAuth("wishlist")) return "";
      const t = Abash.t;
      const list = Abash.getWishlist()
        .map((id) => Abash.getListing(id))
        .filter(Boolean);
      return (
        '<main class="wrap" style="padding:40px 0 72px"><div class="kicker">' +
        t("wishlist") +
        '</div><h1 class="h2">' +
        t("wishlistTitle") +
        "</h1>" +
        (list.length
          ? '<div class="grid" style="margin-top:28px">' + list.map(Abash.cardHTML).join("") + "</div>"
          : '<div class="empty" style="margin-top:28px"><h3 class="h3">' +
            t("wishlistTitle") +
            "</h3><p>" +
            t("wishlistEmpty") +
            '</p><a class="btn btn-primary" href="#/">Explore</a></div>') +
        "</main>"
      );
    },

    viewProfile(params) {
      const t = Abash.t;
      const key = String(params.id || "");
      const list = Abash.getAllListings().filter((l) => {
        if (l.status === "rented" || l.status === "removed") return false;
        const phone = Abash.normPhone(l.phone);
        return phone === key || l.ownerId === key || Abash.normPhone(l.ownerId) === key;
      });
      const name =
        (list[0] && (list[0].contactName || list[0].owner)) ||
        (Abash.findAccount(key) || {}).name ||
        key;
      return (
        '<main class="wrap" style="padding:40px 0 72px"><div class="kicker">' +
        t("profileTitle") +
        '</div><h1 class="h2">' +
        name +
        '</h1><p class="soft" style="margin:8px 0 10px;font-size:14px">' +
        t("profileReviewsLater") +
        '</p><div class="kicker">' +
        t("moreOffers") +
        " · " +
        list.length +
        "</div>" +
        (list.length
          ? '<div class="grid">' + list.map(Abash.cardHTML).join("") + "</div>"
          : '<div class="empty"><p>—</p></div>') +
        "</main>"
      );
    },

    viewListPlace() {
      if (!Abash.requireAuth("list-place")) return "";
      const user = Abash.getUser();
      if (!Abash.isStaffUser(user) && user.intent !== "offer" && user.role === "renter") {
        user.intent = "offer";
        user.role = "owner";
        Abash.setUser(user);
      }
      const t = Abash.t;
      const lang = Abash.getLang();
      const params = Abash.route.params || {};
      const step = params.step || "kind";
      const kindId = params.kind || "";
      const kind = Abash.kindInfo(kindId);
      const propQ = params.pq || "";
      let props = kindId ? Abash.propertiesForKind(kindId) : [];
      props = Abash.filterPropertiesByQuery(props, propQ);
      const propId = params.property || "";
      const selected = propId ? Abash.getBuilding(propId) : null;
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      const until = d.toISOString().slice(0, 10);

      const stepsHtml =
        '<div class="wizard-steps">' +
        '<span class="' +
        (step === "kind" ? "on" : "") +
        '">' +
        t("listStepKind") +
        "</span>" +
        '<span class="' +
        (step === "property" || step === "team" ? "on" : "") +
        '">' +
        t("listStepProperty") +
        "</span>" +
        '<span class="' +
        (step === "vacancy" ? "on" : "") +
        '">' +
        t("listStepVacancy") +
        "</span></div>";

      let body = "";

      if (step === "team" && propId) {
        return Abash.viewTeam({ property: propId, kind: kindId });
      }

      if (step === "kind") {
        body =
          '<p class="soft" style="font-size:13px;margin-bottom:14px">' +
          t("teamRoleHint") +
          ": <b>" +
          (user.role || "owner") +
          "</b></p>" +
          '<div class="kind-grid">' +
          (window.ABASH_KINDS || [])
            .map(
              (k) =>
                '<button type="button" class="kind-card" data-action="list-pick-kind" data-kind="' +
                k.id +
                '"><div class="k-title">' +
                k.id +
                '</div><div class="k-blurb">' +
                (lang === "bn" ? k.blurbBn : k.blurb) +
                "</div></button>"
            )
            .join("") +
          "</div>";
      } else if (step === "property") {
        const editingId = params.edit || "";
        const editing = editingId ? Abash.getBuilding(editingId) : null;
        const showForm = (params.add === "1" || !!editing) && Abash.canAddProperty(user);
        body =
          '<p class="soft" style="font-size:13px;margin-bottom:10px">' +
          t("orgSetupHint") +
          "</p>" +
          '<p class="soft" style="font-size:13px;margin-bottom:14px">' +
          t("pickProperty") +
          " <b>" +
          kindId +
          "</b> " +
          t("pickPropertyHint") +
          "</p>" +
          '<div class="form-row"><input class="input" id="prop-q" placeholder="' +
          t("searchProperty") +
          '" value="' +
          String(propQ).replace(/"/g, "&quot;") +
          '"></div>' +
          (props.length
            ? props
                .map((b) => {
                  const role = Abash.roleOnProperty(user, b.id) || "—";
                  const actions =
                    '<div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end">' +
                    (Abash.canManageTeam(user, b.id)
                      ? '<button type="button" class="btn btn-outline btn-sm" data-action="open-team" data-id="' +
                        b.id +
                        '" style="white-space:nowrap">' +
                        t("manageTeam") +
                        "</button>"
                      : "") +
                    (Abash.canEditProperty(user, b.id)
                      ? '<button type="button" class="btn btn-ghost btn-sm" data-action="edit-property" data-id="' +
                        b.id +
                        '" style="border:0">' +
                        t("editProperty") +
                        "</button>"
                      : "") +
                    '<span class="card-loc">' +
                    t("yourRole") +
                    ": " +
                    role +
                    "</span></div>";
                  return (
                    '<div class="prop-card ' +
                    (propId === b.id ? "on" : "") +
                    '" style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start">' +
                    '<button type="button" data-action="list-pick-property" data-id="' +
                    b.id +
                    '" style="flex:1;text-align:left;background:none;border:0;padding:0;cursor:pointer">' +
                    '<div class="card-title">' +
                    b.name +
                    " · " +
                    b.type +
                    '</div><div class="card-loc">' +
                    b.subArea +
                    ", " +
                    b.area +
                    " · " +
                    [b.road, b.house].filter(Boolean).join(", ") +
                    "</div>" +
                    (b.locationNote
                      ? '<div class="card-loc" style="font-style:italic;margin-top:4px">' +
                        b.locationNote +
                        "</div>"
                      : "") +
                    "</button>" +
                    actions +
                    "</div>"
                  );
                })
                .join("")
            : '<div class="empty" style="margin-bottom:16px"><p>' +
              t("noPropertyYet") +
              "</p></div>") +
          (!showForm && Abash.canAddProperty(user)
            ? '<button type="button" class="btn btn-outline btn-sm" data-action="toggle-add-building" style="margin:12px 0">' +
              t("addBuilding") +
              "</button>"
            : showForm
              ? Abash.propertyFormHTML(t, kind, editing)
              : '<p class="form-hint" style="margin:12px 0">' + t("cannotAddProperty") + "</p>") +
          '<div style="display:flex;gap:12px;margin-top:18px">' +
          '<button type="button" class="btn btn-outline btn-sm" data-action="list-back">' +
          t("back") +
          "</button></div>";
      } else {
        /* vacancy */
        if (!selected || !Abash.canPublishOn(user, selected.id)) {
          body =
            '<div class="empty"><h3 class="h3">' +
            t("cannotPublish") +
            "</h3><p>" +
            t("cannotPublishHint") +
            '</p><a class="btn btn-primary" href="#/dashboard">' +
            t("dashboard") +
            "</a></div>";
        } else {
          const vac = (kind && kind.vacancy) || "unit";
          let fields = "";
          if (vac === "unit") {
            fields =
              '<div class="form-row"><label class="field-label">' +
              t("livingFor") +
              '</label><div class="chip-row">' +
              '<button type="button" class="chip on" data-action="living-set" data-val="Family">' +
              t("family") +
              '</button>' +
              '<button type="button" class="chip" data-action="living-set" data-val="Bachelor">' +
              t("bachelor") +
              "</button></div>" +
              '<input type="hidden" id="lp-living" value="Family"></div>' +
              '<div class="form-row"><label class="field-label">' +
              t("furnishLabel") +
              '</label><div class="chip-row">' +
              '<button type="button" class="chip on" data-action="furnish-set" data-val="Furnished">' +
              t("furnished") +
              "</button>" +
              '<button type="button" class="chip" data-action="furnish-set" data-val="Semi">' +
              t("semiFurnished") +
              "</button>" +
              '<button type="button" class="chip" data-action="furnish-set" data-val="Unfurnished">' +
              t("unfurnished") +
              "</button></div>" +
              '<input type="hidden" id="lp-furnished" value="Furnished"></div>' +
              '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px">' +
              '<div><label class="field-label">Rent (৳/mo)</label><input class="input" id="lp-price" type="number" placeholder="18000"></div>' +
              '<div><label class="field-label">' +
              t("floor") +
              '</label><input class="input" id="lp-floor" placeholder="5th"></div>' +
              '<div><label class="field-label">Beds</label><input class="input" id="lp-beds" type="number" value="2"></div>' +
              '<div><label class="field-label">Baths</label><input class="input" id="lp-baths" type="number" value="2"></div></div>' +
              '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
              '<div><label class="field-label">' +
              t("balcony") +
              '</label><input class="input" id="lp-balcony" type="number" value="1"></div>' +
              '<div><label class="field-label">Sqft</label><input class="input" id="lp-sqft" type="number" placeholder="950"></div></div>';
          } else if (vac === "room") {
            fields =
              '<div class="form-row"><label class="field-label">' +
              t("stayType") +
              '</label><div class="chip-row">' +
              '<button type="button" class="chip on" data-action="stay-set" data-val="Single">' +
              t("staySingle") +
              '</button>' +
              '<button type="button" class="chip" data-action="stay-set" data-val="Shared">' +
              t("stayShared") +
              '</button></div>' +
              '<input type="hidden" id="lp-stay" value="Single"></div>' +
              '<div class="form-row"><label class="field-label">' +
              t("furnishLabel") +
              '</label><div class="chip-row">' +
              '<button type="button" class="chip on" data-action="furnish-set" data-val="Furnished">' +
              t("furnished") +
              "</button>" +
              '<button type="button" class="chip" data-action="furnish-set" data-val="Semi">' +
              t("semiFurnished") +
              "</button>" +
              '<button type="button" class="chip" data-action="furnish-set" data-val="Unfurnished">' +
              t("unfurnished") +
              "</button></div>" +
              '<input type="hidden" id="lp-furnished" value="Furnished"></div>' +
              '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
              '<div><label class="field-label">Rent (৳/mo)</label><input class="input" id="lp-price" type="number" placeholder="7000"></div>' +
              '<div><label class="field-label">' +
              t("floor") +
              '</label><input class="input" id="lp-floor" placeholder="3rd"></div>' +
              '<div><label class="field-label">Bath</label><select class="select" id="lp-bath-type"><option value="attached">' +
              t("attachedBath") +
              '</option><option value="shared">' +
              t("sharedBath") +
              "</option></select></div></div>" +
              '<div class="form-row"><label class="field-label">' +
              t("kitchen") +
              '</label><select class="select" id="lp-kitchen"><option value="Shared">' +
              t("sharedKitchen") +
              '</option><option value="None">' +
              t("noKitchen") +
              '</option><option value="Private">' +
              t("privateKitchen") +
              "</option></select></div>";
          } else if (vac === "seats") {
            fields =
              '<div class="form-row"><label class="field-label">' +
              t("stayType") +
              '</label><div class="chip-row">' +
              '<button type="button" class="chip on" data-action="stay-set" data-val="Shared">' +
              t("stayShared") +
              '</button>' +
              '<button type="button" class="chip" data-action="stay-set" data-val="Single">' +
              t("staySingle") +
              '</button></div>' +
              '<input type="hidden" id="lp-stay" value="Shared"></div>' +
              '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
              '<div><label class="field-label">Rent (৳/mo)</label><input class="input" id="lp-price" type="number" placeholder="5500"></div>' +
              '<div><label class="field-label">' +
              t("seatsFree") +
              '</label><input class="input" id="lp-seats" type="number" value="3" min="1"></div>' +
              '<div><label class="field-label">' +
              t("roomType") +
              '</label><select class="select" id="lp-room-type"><option>Shared room</option><option>Single seat</option><option>Private room</option></select></div></div>';
          } else if (vac === "office") {
            fields =
              '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
              '<div><label class="field-label">Rent (৳/mo)</label><input class="input" id="lp-price" type="number" placeholder="45000"></div>' +
              '<div><label class="field-label">' +
              t("floor") +
              '</label><input class="input" id="lp-floor" placeholder="Ground"></div>' +
              '<div><label class="field-label">Sqft</label><input class="input" id="lp-sqft" type="number" placeholder="800"></div></div>' +
              '<div class="form-row"><label class="field-label">Parking</label><select class="select" id="lp-parking"><option>1 space</option><option>None</option><option>2+ spaces</option></select></div>';
          } else {
            fields =
              '<div class="form-row"><label class="field-label">' +
              t("stayType") +
              '</label><div class="chip-row">' +
              '<button type="button" class="chip on" data-action="stay-set" data-val="Single">' +
              t("staySingle") +
              '</button>' +
              '<button type="button" class="chip" data-action="stay-set" data-val="Shared">' +
              t("stayShared") +
              '</button></div>' +
              '<input type="hidden" id="lp-stay" value="Single"></div>' +
              '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">' +
              '<div><label class="field-label">Rate (৳/night)</label><input class="input" id="lp-price" type="number" placeholder="2500"></div>' +
              '<div><label class="field-label">Beds</label><input class="input" id="lp-beds" type="number" value="1"></div>' +
              '<div><label class="field-label">Baths</label><input class="input" id="lp-baths" type="number" value="1"></div></div>' +
              '<div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
              '<div><label class="field-label">Bath</label><select class="select" id="lp-bath-type"><option value="attached">' +
              t("attachedBath") +
              '</option><option value="shared">' +
              t("sharedBath") +
              "</option></select></div>" +
              '<div><label class="field-label">' +
              t("kitchen") +
              '</label><select class="select" id="lp-kitchen"><option value="None">' +
              t("noKitchen") +
              '</option><option value="Shared">' +
              t("sharedKitchen") +
              '</option><option value="Private">' +
              t("privateKitchen") +
              "</option></select></div></div>" +
              '<p class="form-hint">Call to book — no Airbnb-style calendar in MVP.</p>';
          }

          const pool = window.ABASH_SAMPLE_PHOTOS || [];
          const defaultPhotos =
            vac === "short"
              ? [pool[8] || pool[0]].filter(Boolean)
              : vac === "office"
                ? [pool[10] || pool[0]].filter(Boolean)
                : [pool[0], pool[4]].filter(Boolean);

          body =
            (selected
              ? '<div class="loc-block" style="margin-top:0"><div class="loc-line"><b>' +
                selected.name +
                "</b> · " +
                kindId +
                "</div><div class=\"loc-line\">" +
                selected.subArea +
                ", " +
                selected.area +
                "</div></div>"
              : "") +
            '<div class="form-row"><label class="field-label">Title</label><input class="input" id="lp-title" placeholder="Short title for renters"></div>' +
            fields +
            Abash.photoPickerHTML(t, defaultPhotos) +
            '<div class="form-row"><label class="field-label">Available until</label><input class="input" id="lp-until" type="date" value="' +
            until +
            '"></div>' +
            Abash.contactPickerHTML(selected.id, user) +
            '<div class="form-row"><label class="field-label">Description</label><textarea class="textarea" id="lp-desc"></textarea></div>' +
            '<input type="hidden" id="lp-kind" value="' +
            kindId +
            '"><input type="hidden" id="lp-building" value="' +
            (selected ? selected.id : "") +
            '">' +
            '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
            '<button type="button" class="btn btn-outline" data-action="list-back">' +
            t("back") +
            '</button><button type="button" class="btn btn-primary" data-action="publish" style="flex:1">' +
            t("publish") +
            "</button></div>";
        }
      }

      return (
        '<main class="wrap-md" style="padding:40px 0 72px"><div class="kicker">Offer</div><h1 class="h2">' +
        t("listTitle") +
        '</h1><p class="soft" style="margin:8px 0 22px;font-size:14px">' +
        t("listSub") +
        "</p>" +
        stepsHtml +
        '<div class="panel panel-pad">' +
        body +
        "</div></main>"
      );
    },

    viewTeam(params) {
      if (!Abash.requireAuth("list-place")) return "";
      const user = Abash.getUser();
      const t = Abash.t;
      const propertyId = params.property || "";
      const kindId = params.kind || Abash.route.params.kind || "";
      const b = Abash.getBuilding(propertyId);
      if (!b || !Abash.canManageTeam(user, propertyId)) {
        return (
          '<main class="wrap"><div class="empty" style="margin:48px 0"><h3 class="h3">' +
          t("cannotManageTeam") +
          '</h3><a class="btn btn-primary" href="#/list-place">' +
          t("back") +
          "</a></div></main>"
        );
      }
      const members = Abash.membersForProperty(propertyId);

      return (
        '<main class="wrap-md" style="padding:40px 0 72px"><div class="kicker">' +
        t("propertyTeam") +
        '</div><h1 class="h2">' +
        b.name +
        '</h1><p class="soft" style="margin:8px 0 22px;font-size:14px">' +
        t("propertyTeamSub") +
        "</p>" +
        '<div class="panel panel-pad">' +
        '<div class="kicker">' +
        t("teamMembers") +
        "</div>" +
        (members.length
          ? members
              .map(
                (m) =>
                  '<div class="team-row"><div><div class="card-title">' +
                  m.name +
                  '</div><div class="card-loc">' +
                  m.phone +
                  " · " +
                  (m.role === "admin" ? t("roleAdmin") : t("roleEditor")) +
                  "</div></div>" +
                  (m.role !== "admin"
                    ? '<button type="button" class="link-sm" data-action="remove-member" data-id="' +
                      m.id +
                      '">' +
                      t("remove") +
                      "</button>"
                    : "") +
                  "</div>"
              )
              .join("")
          : "<p class=\"soft\">—</p>") +
        '<div class="rule-soft" style="margin:22px 0"></div>' +
        '<div class="kicker">' +
        t("inviteMember") +
        '</div><div class="form-row"><label class="field-label">' +
        t("name") +
        '</label><input class="input" id="tm-name" placeholder="Name"></div>' +
        '<div class="form-row"><label class="field-label">Phone</label><input class="input" id="tm-phone" type="tel" placeholder="01XXXXXXXXX"></div>' +
        '<input type="hidden" id="tm-role" value="editor">' +
        '<p class="form-hint">' +
        t("inviteHint") +
        "</p>" +
        '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">' +
        '<button type="button" class="btn btn-outline" data-action="list-back-team" data-kind="' +
        kindId +
        '">' +
        t("back") +
        '</button><button type="button" class="btn btn-primary" data-action="invite-member" data-property="' +
        propertyId +
        '">' +
        t("sendInvite") +
        "</button></div></div></main>"
      );
    },

    viewDashboard() {
      if (!Abash.requireAuth("dashboard")) return "";
      const user = Abash.getUser();
      if (!Abash.isStaffUser(user) && user.intent !== "offer" && user.role === "renter") {
        const team = Abash.highestTeamRole(user);
        if (team) {
          user.role = team;
          Abash.setUser(user);
        } else {
          Abash.toast(Abash.t("staffOnly"));
          Abash.go("home");
          return "";
        }
      }
      const t = Abash.t;
      const accessIds = new Set(Abash.accessibleProperties(user).map((b) => b.id));
      const list = Abash.getAllListings().filter((l) => {
        if (l.ownerId === user.id) return true;
        if (l.buildingId && accessIds.has(l.buildingId)) return true;
        return false;
      });
      const views = list.reduce(
        (s, l) => s + (l.views || Math.max(12, 40 - (l.postedDays || 0) * 3)),
        0
      );
      const roleLabel =
        user.role === "editor" || user.role === "manager"
          ? t("roleEditor")
          : t("roleAdmin");

      return (
        '<main class="wrap" style="padding:40px 0 72px"><div style="display:flex;justify-content:space-between;align-items:end;gap:16px;flex-wrap:wrap"><div>' +
        '<div class="kicker">' +
        roleLabel +
        '</div><h1 class="h2">' +
        t("dashTitle") +
        '</h1><p class="soft" style="margin-top:6px;font-size:14px">' +
        user.name +
        " · " +
        user.phone +
        '</p></div>' +
        (user.role !== "caretaker" && user.role !== "editor"
          ? '<a class="btn btn-primary btn-sm" href="#/list-place">' + t("listTitle") + " →</a>"
          : user.role === "editor"
            ? '<a class="btn btn-primary btn-sm" href="#/list-place">' + t("listTitle") + " →</a>"
            : '<a class="btn btn-primary btn-sm" href="#/list-place">' + t("listTitle") + " →</a>") +
        "</div>" +
        (function () {
          const adminProps = Abash.accessibleProperties(user).filter((b) =>
            Abash.canManageTeam(user, b.id)
          );
          if (!adminProps.length) return "";
          return (
            '<div class="panel panel-pad" style="margin:22px 0 28px">' +
            '<div class="kicker">' +
            t("orgSetup") +
            '</div><p class="soft" style="font-size:13px;margin:6px 0 14px">' +
            t("orgSetupHint") +
            "</p>" +
            adminProps
              .map(
                (b) =>
                  '<div class="team-row"><div><div class="card-title">' +
                  b.name +
                  '</div><div class="card-loc">' +
                  b.type +
                  " · " +
                  b.subArea +
                  ", " +
                  b.area +
                  "</div></div>" +
                  '<button type="button" class="btn btn-outline btn-sm" data-action="open-team-dash" data-id="' +
                  b.id +
                  '" data-kind="' +
                  b.type +
                  '">' +
                  t("addEditor") +
                  "</button></div>"
              )
              .join("") +
            "</div>"
          );
        })() +
        '<div class="dash-grid"><div class="stat"><div class="stat-num">' +
        list.length +
        '</div><div class="stat-lbl">' +
        t("active") +
        '</div></div><div class="stat"><div class="stat-num">' +
        views +
        '</div><div class="stat-lbl">' +
        t("views") +
        "</div></div></div>" +
        '<div class="kicker">' +
        t("myListings") +
        "</div>" +
        (list.length
          ? '<div class="dash-list">' +
            list
              .map((l) => {
                const rented = l.status === "rented";
                let actions =
                  '<a class="link-sm" href="#/listing/' + l.id + '">View</a>';
                if (Abash.canStatusListing(user, l)) {
                  actions +=
                    '<button type="button" class="link-sm" data-action="renew" data-id="' +
                    l.id +
                    '">' +
                    t("renew") +
                    "</button>";
                  actions +=
                    '<button type="button" class="link-sm" data-action="toggle-rented" data-id="' +
                    l.id +
                    '">' +
                    (rented ? t("markVacant") : t("markRented")) +
                    "</button>";
                }
                if (Abash.canDeleteListing(user, l)) {
                  actions +=
                    '<button type="button" class="link-sm" data-action="delete-listing" data-id="' +
                    l.id +
                    '">' +
                    t("remove") +
                    "</button>";
                }
                return (
                  '<div class="dash-item"><div class="dash-thumb ' +
                  Abash.mediaClass(l) +
                  '"></div><div><div class="card-title">' +
                  l.title +
                  (rented ? " · " + t("rented") : "") +
                  '</div><div class="card-meta">' +
                  Abash.formatPrice(l.price) +
                  " · " +
                  (l.subArea || l.area) +
                  '</div><div class="card-loc">' +
                  t("availableUntil") +
                  " " +
                  l.availableUntil +
                  '</div></div><div class="dash-actions">' +
                  actions +
                  "</div></div>"
                );
              })
              .join("") +
            "</div>"
          : '<div class="empty"><h3 class="h3">No listings yet</h3><p>' +
            t("dashEmptyHint") +
            '</p><a class="btn btn-primary" href="#/list-place">List a place</a></div>') +
        "</main>"
      );
    },

    render() {
      Abash.route = Abash.parseHash();
      const { name, params } = Abash.route;
      let body = "";
      switch (name) {
        case "area":
          body = Abash.viewArea(params);
          break;
        case "results":
          body = Abash.viewResults(params);
          break;
        case "listing":
          body = Abash.viewListing(params);
          break;
        case "login":
          body = Abash.viewAuth("login", params);
          break;
        case "signup":
          body = Abash.viewAuth("signup", params);
          break;
        case "wishlist":
          body = Abash.viewWishlist();
          break;
        case "profile":
          body = Abash.viewProfile(params);
          break;
        case "list-place":
          body = Abash.viewListPlace();
          break;
        case "why":
          body = Abash.viewWhy();
          break;
        case "dashboard":
          body = Abash.viewDashboard();
          break;
        default:
          body = Abash.viewHome();
      }
      if (!body) return;
      const root = document.getElementById("app");
      root.innerHTML = Abash.shell(body);
      window.scrollTo(0, 0);
      Abash.bind();
    },

    bind() {
      const root = document.getElementById("app");
      let authRole = "renter";
      let authStep = "phone";

      root.onclick = function (e) {
        const el = e.target.closest("[data-action],[data-set],[data-save]");
        if (!el) return;

        if (el.hasAttribute("data-save")) {
          e.preventDefault();
          e.stopPropagation();
          const on = Abash.toggleSave(el.getAttribute("data-save"));
          if (on === false) return;
          el.classList.toggle("on", on);
          Abash.toast(on ? Abash.t("saved") : Abash.t("save"));
          return;
        }

        const action = el.getAttribute("data-action");
        const setKey = el.getAttribute("data-set");

        if (setKey) {
          const val = el.getAttribute("data-val");
          if (setKey === "category") {
            const prev = Abash.getSearch();
            Abash.setSearch({
              ...Abash.searchDefaults(val),
              area: prev.area,
              subArea: prev.subArea,
              sort: prev.sort
            });
          } else {
            Abash.setSearch({ [setKey]: val });
          }
          Abash.render();
          return;
        }

        if (action === "lang") {
          Abash.toggleLang();
          return;
        }

        if (action === "scroll-search") {
          e.preventDefault();
          const el = document.getElementById("search");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        if (action === "logout") {
          Abash.logout();
          return;
        }
        if (action === "pick-area") {
          Abash.go("area", { from: "home" });
          return;
        }
        if (action === "pick-area-list") {
          Abash.go("area", { from: "list" });
          return;
        }
        if (action === "search") {
          const s = Abash.getSearch();
          refineOpen = false;
          Abash.go("results", { ...s });
          return;
        }
        if (action === "toggle-refine") {
          refineOpen = !refineOpen;
          Abash.render();
          return;
        }
        if (action === "refine-set") {
          refineOpen = true;
          const key = el.getAttribute("data-key");
          const val = el.getAttribute("data-val");
          if (key === "category") {
            const prev = Abash.getSearch();
            Abash.setSearch({
              ...Abash.searchDefaults(val),
              area: prev.area,
              subArea: prev.subArea,
              sort: prev.sort
            });
          } else {
            Abash.setSearch({ [key]: val });
          }
          Abash.go("results", { ...Abash.getSearch() });
          return;
        }
        if (action === "pick-area-results") {
          refineOpen = true;
          Abash.go("area", { from: "results" });
          return;
        }
        if (action === "list-pick-kind") {
          Abash.go("list-place", { step: "property", kind: el.getAttribute("data-kind") });
          return;
        }
        if (action === "list-pick-property") {
          const user = Abash.getUser();
          const pid = el.getAttribute("data-id");
          if (!Abash.canPublishOn(user, pid)) {
            Abash.toast(Abash.t("cannotPublishHint"));
            Abash.go("dashboard");
            return;
          }
          Abash.go("list-place", {
            step: "vacancy",
            kind: Abash.route.params.kind,
            property: pid
          });
          return;
        }
        if (action === "open-team") {
          e.preventDefault();
          e.stopPropagation();
          Abash.go("list-place", {
            step: "team",
            kind: Abash.route.params.kind,
            property: el.getAttribute("data-id")
          });
          return;
        }
        if (action === "open-team-dash") {
          Abash.go("list-place", {
            step: "team",
            kind: el.getAttribute("data-kind") || "Home",
            property: el.getAttribute("data-id")
          });
          return;
        }
        if (action === "list-back-team") {
          Abash.go("list-place", {
            step: "property",
            kind: el.getAttribute("data-kind") || Abash.route.params.kind
          });
          return;
        }
        if (action === "invite-member") {
          const user = Abash.getUser();
          const propertyId = el.getAttribute("data-property");
          const actorRole = Abash.roleOnProperty(user, propertyId);
          if (!Abash.canInviteRole(actorRole, "editor")) {
            Abash.toast(Abash.t("cannotManageTeam"));
            return;
          }
          const res = Abash.inviteMember(propertyId, {
            phone: ($("#tm-phone") || {}).value,
            name: ($("#tm-name") || {}).value,
            role: "editor"
          });
          if (!res.ok) {
            Abash.toast("Enter a valid phone");
            return;
          }
          Abash.toast(Abash.t("inviteSaved"));
          Abash.render();
          return;
        }
        if (action === "remove-member") {
          Abash.removeMember(el.getAttribute("data-id"));
          Abash.toast(Abash.t("memberRemoved"));
          Abash.render();
          return;
        }
        if (action === "list-back") {
          const p = Abash.route.params || {};
          if (p.step === "team" || p.step === "vacancy")
            Abash.go("list-place", { step: "property", kind: p.kind });
          else Abash.go("list-place", { step: "kind" });
          return;
        }
        if (action === "toggle-add-building") {
          Abash.go("list-place", {
            step: "property",
            kind: Abash.route.params.kind,
            add: "1"
          });
          return;
        }
        if (action === "edit-property") {
          e.preventDefault();
          e.stopPropagation();
          Abash.go("list-place", {
            step: "property",
            kind: Abash.route.params.kind,
            edit: el.getAttribute("data-id")
          });
          return;
        }
        if (action === "cancel-edit-property") {
          Abash.go("list-place", {
            step: "property",
            kind: Abash.route.params.kind
          });
          return;
        }
        if (action === "living-set") {
          const val = el.getAttribute("data-val");
          const hidden = $("#lp-living");
          if (hidden) hidden.value = val;
          $all("[data-action=living-set]", root).forEach((b) =>
            b.classList.toggle("on", b === el)
          );
          return;
        }
        if (action === "furnish-set") {
          const val = el.getAttribute("data-val");
          const hidden = $("#lp-furnished");
          if (hidden) hidden.value = val;
          $all("[data-action=furnish-set]", root).forEach((b) =>
            b.classList.toggle("on", b === el)
          );
          return;
        }
        if (action === "stay-set") {
          const val = el.getAttribute("data-val");
          const hidden = $("#lp-stay");
          if (hidden) hidden.value = val;
          $all("[data-action=stay-set]", root).forEach((b) =>
            b.classList.toggle("on", b === el)
          );
          return;
        }
        if (action === "toggle-photo") {
          e.preventDefault();
          const url = el.getAttribute("data-url");
          const hidden = $("#lp-photos");
          if (!hidden || !url) return;
          let sel = hidden.value ? hidden.value.split("|").filter(Boolean) : [];
          const i = sel.indexOf(url);
          if (i >= 0) sel.splice(i, 1);
          else sel.push(url);
          hidden.value = sel.join("|");
          el.classList.toggle("on", i < 0);
          return;
        }
        if (action === "save-building") {
          const name = ($("#nb-name") || {}).value.trim();
          const area = ($("#nb-area") || {}).value.trim();
          if (!name || !area) {
            Abash.toast("Property name and area required");
            return;
          }
          const lat = Number(($("#nb-lat") || {}).value);
          const lng = Number(($("#nb-lng") || {}).value);
          const patch = {
            name,
            type: $("#nb-type").value,
            area,
            subArea: ($("#nb-sub") || {}).value.trim() || area,
            road: ($("#nb-road") || {}).value.trim(),
            block: ($("#nb-block") || {}).value.trim(),
            house: ($("#nb-house") || {}).value.trim(),
            locationNote: ($("#nb-note") || {}).value.trim(),
            gender: (($("#nb-gender") || {}).value || "").trim(),
            lat: lat || undefined,
            lng: lng || undefined
          };
          const editId = el.getAttribute("data-edit-id");
          if (editId) {
            Abash.updateBuilding(editId, patch);
            Abash.toast(Abash.t("propertyUpdated"));
            Abash.go("list-place", {
              step: "property",
              kind: Abash.route.params.kind,
              property: editId
            });
          } else {
            const user = Abash.getUser();
            if (!Abash.canAddProperty(user)) {
              Abash.toast(Abash.t("cannotAddProperty"));
              return;
            }
            const b = {
              id: "b" + Date.now(),
              ...patch,
              createdBy: user.id,
              ownerPhone: user.phone,
              ownerName: user.name
            };
            Abash.addBuilding(b);
            Abash.ensureOwnerMember(b, user);
            Abash.toast(Abash.t("propertySaved"));
            Abash.go("list-place", {
              step: "vacancy",
              kind: Abash.route.params.kind,
              property: b.id
            });
          }
          return;
        }
        if (action === "quick-area") {
          const defs = Abash.searchDefaults("Home");
          Abash.setSearch({ ...defs, area: el.getAttribute("data-area"), subArea: "" });
          Abash.go("results", { ...Abash.getSearch() });
          return;
        }
        if (action === "toggle-area") {
          el.classList.toggle("open");
          return;
        }
        if (action === "choose-area") {
          const area = el.getAttribute("data-area");
          const sub = el.getAttribute("data-sub") || "";
          const from = el.getAttribute("data-from") || "home";
          Abash.addRecentArea(sub ? sub + ", " + area : area);
          Abash.setSearch({ area, subArea: sub });
          if (from === "list") Abash.go("list-place");
          else if (from === "results") {
            refineOpen = true;
            Abash.go("results", { ...Abash.getSearch() });
          } else Abash.go("home");
          return;
        }
        if (action === "recent-area") {
          const label = el.getAttribute("data-label");
          const from = el.getAttribute("data-from") || "home";
          const parts = label.split(",").map((x) => x.trim());
          let area = parts[parts.length - 1].replace(/\s*Dhaka$/, "");
          let sub = parts.length > 1 ? parts[0] : "";
          const found = (window.ABASH_AREAS || []).find(
            (a) => a.name === area || a.subs.some((s) => s.name === sub || s.name === parts[0])
          );
          if (found) {
            area = found.name;
            if (found.subs.some((s) => s.name === parts[0])) sub = parts[0];
          }
          Abash.setSearch({ area, subArea: sub });
          if (from === "list") Abash.go("list-place");
          else if (from === "results") {
            refineOpen = true;
            Abash.go("results", { ...Abash.getSearch() });
          } else Abash.go("home");
          return;
        }
        if (action === "results-cat") {
          const prev = Abash.getSearch();
          const val = el.getAttribute("data-val");
          Abash.setSearch({
            ...Abash.searchDefaults(val),
            area: prev.area,
            subArea: prev.subArea,
            sort: prev.sort
          });
          Abash.go("results", { ...Abash.getSearch() });
          return;
        }
        if (action === "role") {
          authRole = el.getAttribute("data-role");
          $all("[data-action=role]", root).forEach((b) => b.classList.toggle("on", b === el));
          return;
        }
        if (action === "auth-submit") {
          const card = $("#auth-card");
          const mode = card.getAttribute("data-mode");
          const phone = ($("#auth-phone") || {}).value.trim();
          const name = (($("#auth-name") || {}).value || "").trim();
          const pass = (($("#auth-pass") || {}).value || "").trim();
          const pass2 = (($("#auth-pass2") || {}).value || "").trim();
          if (!phone || phone.length < 10) {
            Abash.toast("Enter a valid phone");
            return;
          }
          if (mode === "login") {
            if (!pass) {
              Abash.toast(Abash.t("passwordShort"));
              return;
            }
            const res = Abash.loginAccount(phone, pass);
            if (!res.ok) {
              Abash.toast(Abash.t("wrongPassword"));
              return;
            }
            const teamRole = Abash.highestTeamRole({ phone });
            const intent = authRole === "owner" ? "offer" : "look";
            Abash.setUser({
              id: res.account.id,
              phone: res.account.phone,
              name: res.account.name,
              role: teamRole || (intent === "offer" ? "owner" : "renter"),
              intent
            });
            const next =
              card.getAttribute("data-next") ||
              (intent === "offer" || teamRole ? "dashboard" : "home");
            Abash.toast("Signed in");
            Abash.go(next);
            return;
          }
          /* signup */
          if (authStep === "phone") {
            if (!name) {
              Abash.toast("Enter your name");
              return;
            }
            if (!pass || pass.length < 6) {
              Abash.toast(Abash.t("passwordShort"));
              return;
            }
            if (pass !== pass2) {
              Abash.toast(Abash.t("passwordMismatch"));
              return;
            }
            if (Abash.findAccount(phone)) {
              Abash.toast(Abash.t("accountExists"));
              return;
            }
            Abash.sendOtp(phone);
            authStep = "otp";
            const wrap = $("#otp-wrap");
            if (wrap) wrap.style.display = "block";
            $("#auth-btn").textContent = Abash.t("verifyContinue");
            Abash.toast("OTP sent (demo: 1234)");
            return;
          }
          const otp = ($("#auth-otp") || {}).value.trim();
          if (!Abash.verifyOtp(phone, otp)) {
            Abash.toast("Wrong OTP — use 1234");
            return;
          }
          const created = Abash.registerAccount({ phone, password: pass, name });
          if (!created.ok) {
            Abash.toast(Abash.t("accountExists"));
            return;
          }
          const intent = authRole === "owner" ? "offer" : "look";
          Abash.setUser({
            id: created.account.id,
            phone: created.account.phone,
            name: created.account.name,
            role: intent === "offer" ? "owner" : "renter",
            intent
          });
          const next =
            card.getAttribute("data-next") || (intent === "offer" ? "dashboard" : "home");
          Abash.toast("Account created");
          Abash.go(next);
          return;
        }
        if (action === "publish") {
          const user = Abash.getUser();
          const kindId = ($("#lp-kind") || {}).value || Abash.route.params.kind;
          const kind = Abash.kindInfo(kindId);
          const vac = (kind && kind.vacancy) || "unit";
          const buildingId = ($("#lp-building") || {}).value;
          const building = Abash.getBuilding(buildingId);
          const title = (($("#lp-title") || {}).value || "").trim();
          const price = Number(($("#lp-price") || {}).value);
          if (!title || !price || !building) {
            Abash.toast("Add title, price, and select a property");
            return;
          }
          if (!Abash.canPublishOn(user, building.id)) {
            Abash.toast(Abash.t("cannotPublish"));
            return;
          }
          const photoRaw = (($("#lp-photos") || {}).value || "").trim();
          const photos = photoRaw
            ? photoRaw.split("|").filter(Boolean)
            : Abash.listingPhotos({ id: "new", category: kindId });
          const videoUrl = (($("#lp-video") || {}).value || "").trim();
          const phone =
            (($("#lp-phone") || {}).value || "").trim() || user.phone;
          const listing = {
            id: "u" + Date.now(),
            title,
            titleBn: title,
            category: kindId,
            listingKind: vac,
            area: building.area,
            subArea: building.subArea || building.area,
            road: building.road,
            block: building.block,
            house: building.house,
            locationNote: building.locationNote,
            lat: building.lat,
            lng: building.lng,
            photos,
            videoUrl: videoUrl || undefined,
            price,
            media: "m" + (1 + Math.floor(Math.random() * 6)),
            phone,
            contactName: user.name,
            owner: user.name,
            ownerBn: user.name,
            ownerId: user.id,
            buildingId: building.id,
            status: "active",
            postedDays: 0,
            availableUntil: ($("#lp-until") || {}).value,
            description: (($("#lp-desc") || {}).value || "").trim() || "Listed on Abash by the owner.",
            descriptionBn: (($("#lp-desc") || {}).value || "").trim() || "মালিক Abash‑এ তালিকাভুক্ত করেছেন।",
            amenities: [],
            views: 0,
            beds: 0,
            baths: 0,
            sqft: 0,
            floor: "",
            balcony: 0
          };
          if (vac === "unit") {
            listing.floor = (($("#lp-floor") || {}).value || "").trim();
            listing.beds = Number(($("#lp-beds") || {}).value) || 0;
            listing.baths = Number(($("#lp-baths") || {}).value) || 0;
            listing.balcony = Number(($("#lp-balcony") || {}).value) || 0;
            listing.sqft = Number(($("#lp-sqft") || {}).value) || 0;
            listing.livingFor = ($("#lp-living") || {}).value || "Family";
            listing.furnished = ($("#lp-furnished") || {}).value || "Furnished";
            listing.amenities = ["Gas line", "Water line", listing.livingFor, listing.furnished];
          } else if (vac === "room") {
            listing.floor = (($("#lp-floor") || {}).value || "").trim();
            listing.beds = 1;
            listing.baths = 1;
            listing.stayType = ($("#lp-stay") || {}).value || "Single";
            listing.furnished = ($("#lp-furnished") || {}).value || "Furnished";
            listing.attachedBath = ($("#lp-bath-type") || {}).value === "attached";
            listing.kitchen = ($("#lp-kitchen") || {}).value;
            listing.amenities = [
              listing.stayType,
              listing.furnished,
              listing.attachedBath ? "Attached bath" : "Shared bath",
              (listing.kitchen || "Shared") + " kitchen"
            ];
          } else if (vac === "seats") {
            listing.seatsFree = Number(($("#lp-seats") || {}).value) || 1;
            listing.stayType = ($("#lp-stay") || {}).value || "Shared";
            listing.roomType = ($("#lp-room-type") || {}).value;
            listing.beds = 1;
            listing.baths = 1;
            listing.amenities = [
              listing.stayType,
              listing.roomType,
              building.gender ? building.gender + " only" : ""
            ].filter(Boolean);
          } else if (vac === "office") {
            listing.floor = (($("#lp-floor") || {}).value || "").trim();
            listing.sqft = Number(($("#lp-sqft") || {}).value) || 0;
            listing.parking = ($("#lp-parking") || {}).value;
            listing.amenities = ["Office", listing.parking].filter(Boolean);
          } else if (vac === "short") {
            listing.priceUnit = "night";
            listing.stayType = ($("#lp-stay") || {}).value || "Single";
            listing.beds = Number(($("#lp-beds") || {}).value) || 1;
            listing.baths = Number(($("#lp-baths") || {}).value) || 1;
            listing.attachedBath = ($("#lp-bath-type") || {}).value === "attached";
            listing.kitchen = ($("#lp-kitchen") || {}).value;
            listing.amenities = [
              listing.stayType,
              listing.attachedBath ? "Attached bath" : "Shared bath",
              (listing.kitchen || "None") + " kitchen"
            ];
          }
          Abash.addListing(listing);
          Abash.toast("Listing is live!");
          Abash.go("listing", { id: listing.id });
          return;
        }
        if (action === "delete-listing") {
          const user = Abash.getUser();
          const listing = Abash.getListing(el.getAttribute("data-id"));
          if (!Abash.canDeleteListing(user, listing)) {
            Abash.toast(Abash.t("cannotPublish"));
            return;
          }
          Abash.removeMyListing(el.getAttribute("data-id"));
          Abash.patchListing(el.getAttribute("data-id"), { status: "removed" });
          Abash.toast("Removed");
          Abash.render();
          return;
        }
        if (action === "renew") {
          const id = el.getAttribute("data-id");
          const listing = Abash.getListing(id);
          if (!listing || !Abash.canStatusListing(Abash.getUser(), listing)) return;
          const d = new Date(listing.availableUntil || Date.now());
          d.setMonth(d.getMonth() + 1);
          Abash.patchListing(id, { availableUntil: d.toISOString().slice(0, 10) });
          Abash.toast("Availability extended");
          Abash.render();
          return;
        }
        if (action === "toggle-rented") {
          const id = el.getAttribute("data-id");
          const listing = Abash.getListing(id);
          if (!listing || !Abash.canStatusListing(Abash.getUser(), listing)) return;
          const next = listing.status === "rented" ? "active" : "rented";
          Abash.patchListing(id, { status: next });
          Abash.toast(next === "rented" ? Abash.t("markRented") : Abash.t("markVacant"));
          Abash.render();
          return;
        }
        if (action === "report") {
          Abash.toast("Report submitted (demo)");
          return;
        }
        if (action === "no-chat") {
          Abash.toast("No chat in MVP — use phone");
          return;
        }
      };

      root.onchange = function (e) {
        if (e.target.getAttribute("data-action") === "results-sort") {
          const s = Abash.getSearch();
          Abash.go("results", { ...s, sort: e.target.value });
          return;
        }
        if (e.target.id === "lp-contact") {
          return;
        }
      };

      const areaQ = $("#area-q");
      if (areaQ) {
        areaQ.oninput = function () {
          Abash.go("area", { from: Abash.route.params.from || "home", q: areaQ.value });
        };
      }
      const propQ = $("#prop-q");
      if (propQ) {
        propQ.oninput = function () {
          const p = Abash.route.params || {};
          Abash.go("list-place", {
            step: "property",
            kind: p.kind,
            pq: propQ.value
          });
        };
      }
    },

    init() {
      Abash.setLang(Abash.getLang());
      window.addEventListener("hashchange", () => Abash.render());
      if (!location.hash || location.hash === "#") location.hash = "#/";
      else Abash.render();
    }
  };

  window.Abash = Abash;
})();
