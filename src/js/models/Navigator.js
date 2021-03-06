import Publication from "./Publication";
export default class Navigator {
    constructor(publication) {
        this.spreads = [];
        this.ttb = publication.isTtb;
        this.shift = true;

        this.index(publication);
        this.testShift(publication);
        console.log(`Indexed ${this.spreads.length} spreads for ${publication.spine.length} items`);
    }

    index(publication, redo = false) {
        this.nLandscape = 0;
        publication.spine.forEach((item, index) => {
            if (!/^(?:[a-z]+:)?\/\//i.test(item.href)) // convert URL relative to manifest to absolute URL
                item.href = new URL(item.href, publication.url).href;
            item.xbr = item.xbr ? item.xbr : {};
            item.properties = item.properties ? item.properties : {};
            item.properties.spread = item.properties.spread ? item.properties.spread : "landscape";
            if(!redo) {
                item.xbr.number = index + 1;
                Publication.fixDeprecated(item, "mime", "type");
                if(item.type.indexOf("image/") == 0)
                    item.xbr.isImage = true;
                if(!item.properties.orientation) item.properties.orientation = item.width > item.height ? "landscape" : "portrait";
            }
            const isLandscape = item.properties.orientation === "landscape" ? true : false;
            if(!item.properties.page || redo) item.properties.page = isLandscape ? "center" : ((((this.shift ? 0 : 1) + index - this.nLandscape) % 2) ? (publication.rtl ? "right" : "left") : (publication.rtl ? "left" : "right"));
            if(isLandscape)
                this.nLandscape++;
        });
        if(redo)
            this.spreads = [];
        this.buildSpreads(publication.spine);
    }

    testShift(publication) {
        let wasLastSingle = false;
        this.spreads.forEach((item, index) => {
            if(item.length > 1)
                return; // Only left with single-page "spreads"
            const single = item[0];

            // If last was a true single, and this spread is a center page (that's not special), something's wrong
            if(wasLastSingle && single.properties.page === "center")
                if(single.xbr.final) {
                    this.spreads[index - 1][0].xbr.addBlank = true;
                    this.nLandscape++;
                } else
                    this.shift = false;
            
            // If this single page spread is an orphaned component of a double page spread (and it's not the first page)
            if(single.properties.orientation === "portrait" && single.properties.page !== "center" && single.xbr.number > 1)
                wasLastSingle = true;
            else
                wasLastSingle = false;
        });
        if(!this.shift)
            this.index(publication, true); // Re-index spreads
    }

    buildSpreads(spine) {
        let currentSet = [];
        spine.forEach((item, index) => {
            if(!index && this.shift) {
                this.spreads.push([item]);
            } else if(item.properties.page === "center") { // If a center (single) page spread, push immediately and reset current set
                if(currentSet.length > 0) this.spreads.push(currentSet);
                this.spreads.push([item]);
                currentSet = [];
            } else if (currentSet.length >= 2) { // Spread has max 2 pages
                this.spreads.push(currentSet);
                currentSet = [item];
            } else // Add this item to current set
                currentSet.push(item);
        });
        if(currentSet.length > 0) this.spreads.push(currentSet);
    }

    getPageString(slider) {
        if(this.ttb) {
            return `${Math.floor((document.documentElement.scrollTop + document.body.scrollTop) / slider.selector.scrollHeight * 100)}%`;
        } else if (!slider.single && !slider.ttb) {
            let spreadString = "";
            const spread = this.spreads[Math.floor(slider.currentSlide / slider.perPage)];
            if(!spread) {
                console.error(`Went off the edge of the spine @${slider.currentSlide}`);
                return "?";
            }
            if(spread.length && spread[0].xbr.final)
                return __("END");
            spread.forEach((item, index) => {
                if(!index)
                    spreadString += item.xbr.number;
                else
                    spreadString += "-" + item.xbr.number;
            });
            return spreadString;
        } else {
            const spread = this.spreads[this.spreads.length - 1];
            if(slider.currentSlide + 1 === slider.length && spread && spread.length && spread[0].xbr.final)
                return __("END");
            return slider.currentSlide + 1;
        }
    }
}